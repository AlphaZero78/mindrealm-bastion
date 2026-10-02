using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Windows.Forms;

// The portable EXE lives at the package root. It never depends on the caller's
// working directory, a global Node installation, or a player's save directory.
internal static class GameLauncher
{
    private enum Health { Absent, Game, Foreign }
    private sealed class LaunchFailure : Exception
    {
        internal readonly int Code;
        internal LaunchFailure(int code, string message) : base(message) { Code = code; }
    }
    [DataContract]
    private sealed class HealthDocument
    {
        [DataMember(Name = "app")] public string App { get; set; }
        [DataMember(Name = "version")] public int Version { get; set; }
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct StartupInfo
    {
        internal int Size;
        internal string Reserved, Desktop, Title;
        internal uint X, Y, XSize, YSize, XCountChars, YCountChars, FillAttribute, Flags;
        internal ushort ShowWindow, ReservedSize;
        internal IntPtr ReservedPointer, StandardInput, StandardOutput, StandardError;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInfo
    {
        internal IntPtr Process, Thread;
        internal uint ProcessId, ThreadId;
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CreateProcess(string application, StringBuilder commandLine,
        IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles, uint creationFlags,
        IntPtr environment, string currentDirectory, ref StartupInfo startup, out ProcessInfo process);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll")] private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll")] private static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);
    [DllImport("kernel32.dll")] private static extern bool TerminateProcess(IntPtr process, uint exitCode);

    private sealed class ServerProcess : IDisposable
    {
        private IntPtr handle;
        internal ServerProcess(IntPtr value) { handle = value; }
        internal bool HasExited { get { return WaitForSingleObject(handle, 0) == 0; } }
        internal uint ExitCode { get { uint code; GetExitCodeProcess(handle, out code); return code; } }
        internal void Kill() { TerminateProcess(handle, 1); WaitForSingleObject(handle, 1000); }
        public void Dispose() { if (handle != IntPtr.Zero) { CloseHandle(handle); handle = IntPtr.Zero; } }
    }

    private static ServerProcess SpawnHidden(string root, string node, string server, int port)
    {
        var startup = new StartupInfo { Size = Marshal.SizeOf(typeof(StartupInfo)) };
        ProcessInfo child;
        string previousPort = Environment.GetEnvironmentVariable("MINDREALM_PORT");
        try
        {
            // This single-purpose process has no other child launches in flight.
            // The child inherits QA and the explicit port, but no OS handles.
            Environment.SetEnvironmentVariable("MINDREALM_PORT", port.ToString());
            if (!CreateProcess(node, new StringBuilder("\"" + node + "\" \"" + server + "\""),
                IntPtr.Zero, IntPtr.Zero, false, 0x08000000 /* CREATE_NO_WINDOW */,
                IntPtr.Zero, root, ref startup, out child))
                throw new Win32Exception(Marshal.GetLastWin32Error());
        }
        finally { Environment.SetEnvironmentVariable("MINDREALM_PORT", previousPort); }
        CloseHandle(child.Thread);
        return new ServerProcess(child.Process);
    }

    [STAThread]
    private static int Main(string[] args)
    {
        int port = 4173;
        // Find this flag even when another argument is invalid: unattended QA
        // must always receive an exit code instead of a blocking error dialog.
        bool noBrowser = Array.IndexOf(args, "--no-browser") >= 0;
        try
        {
            bool portSeen = false;
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--no-browser") continue;
                if (args[i] != "--port" || portSeen || ++i >= args.Length ||
                    !Int32.TryParse(args[i], out port) || port < 1 || port > 65535)
                    throw new LaunchFailure(2, "启动参数无效。可使用 --port 端口号（1–65535）和 --no-browser。");
                portSeen = true;
            }

            string packageRoot = Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory);
            // New portable packages keep supporting files together in game/.
            // The flat layout remains supported for existing local packages.
            string payload = Path.Combine(packageRoot, "game");
            string root = Directory.Exists(payload) ? payload : packageRoot;
            string node = Path.Combine(root, "runtime", "node.exe");
            string server = Path.Combine(root, "launcher", "server.mjs");
            foreach (string file in new[] { node, server, Path.Combine(root, "web", "index.html") })
                if (!File.Exists(file))
                    throw new LaunchFailure(3, "游戏文件不完整，缺少：\n" + file + "\n请完整解压游戏压缩包后，再运行启动游戏.exe。");

            string url = "http://127.0.0.1:" + port;
            // Probe once before waiting, then again while owning the user/port
            // lock. Only this launcher serializes startup; existing services
            // are identified by their health response and are never killed.
            Health first = Probe(url);
            if (first == Health.Foreign) throw PortOccupied(port);
            string user = WindowsIdentity.GetCurrent().User.Value;
            using (var mutex = new Mutex(false, "Local\\MindrealmBastionLauncher-" + user + "-" + port))
            {
                bool locked = false;
                try
                {
                    try { locked = mutex.WaitOne(15000); }
                    catch (AbandonedMutexException) { locked = true; }
                    if (!locked) throw new LaunchFailure(6, "另一启动程序仍在启动游戏，请稍后重试。");
                    Health current = Probe(url);
                    if (current == Health.Foreign) throw PortOccupied(port);
                    if (current != Health.Game) StartServer(root, node, server, url, port);
                }
                finally { if (locked) mutex.ReleaseMutex(); }
            }

            string browserUrl = url + (Environment.GetEnvironmentVariable("MINDREALM_QA") == "1" ? "/?qa=1" : "/");
            if (!noBrowser)
            {
                try { Process.Start(new ProcessStartInfo(browserUrl) { UseShellExecute = true }); }
                catch (Exception e)
                {
                    throw new LaunchFailure(7, "游戏已启动，但无法打开默认浏览器。\n请在浏览器中打开：" + browserUrl + "\n" + e.Message);
                }
            }
            Console.WriteLine("MINDREALM_WEB_READY " + browserUrl);
            return 0;
        }
        catch (Exception error)
        {
            var failure = error as LaunchFailure;
            int code = failure == null ? 9 : failure.Code;
            string message = failure == null ? "无法启动心域防线。\n" + error.Message : error.Message;
            string log = WriteError(port, error, code);
            if (log != null) message += "\n错误记录：" + log;
            if (noBrowser) Console.Error.WriteLine(message);
            else MessageBox.Show(message, "心域防线 — 启动失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return code;
        }
    }

    private static LaunchFailure PortOccupied(int port)
    {
        return new LaunchFailure(4, "端口 " + port + " 正被其他程序使用。启动器不会关闭它。\n请关闭占用程序，或使用 --port 指定其他端口。");
    }

    private static Health Probe(string url)
    {
        var deadline = Stopwatch.StartNew();
        var request = (HttpWebRequest)WebRequest.Create(url + "/health");
        request.Proxy = null; // Loopback health must not go through a system proxy.
        request.Timeout = 700;
        request.ReadWriteTimeout = 700;
        request.AllowAutoRedirect = false;
        request.KeepAlive = false;
        try
        {
            using (var response = (HttpWebResponse)request.GetResponse())
            {
                if (response.StatusCode != HttpStatusCode.OK) return Health.Foreign;
                // Bound the untrusted response from a potentially unrelated app.
                using (var data = new MemoryStream())
                using (var stream = response.GetResponseStream())
                {
                    byte[] buffer = new byte[1024];
                    int count;
                    while ((count = stream.Read(buffer, 0, buffer.Length)) > 0)
                    {
                        if (deadline.ElapsedMilliseconds > 1400 || data.Length + count > 4096) return Health.Foreign;
                        data.Write(buffer, 0, count);
                    }
                    data.Position = 0;
                    var document = (HealthDocument)new DataContractJsonSerializer(typeof(HealthDocument)).ReadObject(data);
                    return document != null && document.App == "mindrealm-bastion" && document.Version == 1 ? Health.Game : Health.Foreign;
                }
            }
        }
        catch (WebException e)
        {
            if (e.Response != null) e.Response.Close();
            // Framework HttpWebRequest may report Timeout before Windows has
            // reported ConnectionRefused for an empty loopback port. Consult
            // the local listener table to distinguish it from a silent app.
            if (e.Response == null && (e.Status == WebExceptionStatus.ConnectFailure || e.Status == WebExceptionStatus.Timeout))
            {
                try
                {
                    int port = new Uri(url).Port;
                    foreach (var endpoint in IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners())
                        if (endpoint.Port == port && (endpoint.Address.Equals(IPAddress.Loopback) ||
                            endpoint.Address.Equals(IPAddress.Any) || endpoint.Address.Equals(IPAddress.IPv6Any)))
                            return Health.Foreign;
                    return Health.Absent;
                }
                catch (NetworkInformationException) { return Health.Foreign; }
            }
            return Health.Foreign;
        }
        catch (SerializationException) { return Health.Foreign; }
        catch (System.Xml.XmlException) { return Health.Foreign; }
        catch (IOException) { return Health.Foreign; }
    }

    private static void StartServer(string root, string node, string server, string url, int port)
    {
        ServerProcess child = null;
        bool ready = false;
        try
        {
            // Framework Process.Start can inherit the launcher's redirected
            // stdout even when it does not redirect its own child. Explicit
            // native handle isolation lets the server outlive any QA terminal.
            child = SpawnHidden(root, node, server, port);
            var timer = Stopwatch.StartNew();
            while (timer.ElapsedMilliseconds < 10000)
            {
                if (child.HasExited)
                    throw new LaunchFailure(5, "游戏服务提前退出（代码 " + child.ExitCode + "）。请重新完整解压游戏文件。");
                Health health = Probe(url);
                if (health == Health.Game) { ready = true; return; }
                if (health == Health.Foreign) throw PortOccupied(port);
                Thread.Sleep(120);
            }
            throw new LaunchFailure(5, "游戏服务未能在规定时间内启动，请稍后重试。");
        }
        catch (LaunchFailure) { throw; }
        catch (Exception e) { throw new LaunchFailure(5, "无法运行包内游戏服务。\n" + e.Message); }
        finally
        {
            if (child != null)
            {
                // Only a child created by this invocation may be stopped, and
                // only if it never passed health. Never kill by port or name.
                if (!ready) { try { if (!child.HasExited) child.Kill(); } catch { } }
                child.Dispose();
            }
        }
    }

    private static string WriteError(int port, Exception error, int code)
    {
        try
        {
            string file = Path.Combine(Path.GetTempPath(), "mindrealm-launcher-" + port + "-" +
                DateTime.UtcNow.ToString("yyyyMMdd-HHmmss") + "-" + Process.GetCurrentProcess().Id + ".log");
            File.WriteAllText(file, "心域防线启动失败\r\n退出代码：" + code + "\r\n" + error, new UTF8Encoding(false));
            return file;
        }
        catch { return null; }
    }
}
