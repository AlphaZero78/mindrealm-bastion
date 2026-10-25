# GitHub Pages 在线版

在线地址：[https://alphazero78.github.io/mindrealm-bastion/](https://alphazero78.github.io/mindrealm-bastion/)。

## 发布流程

`.github/workflows/pages.yml` 在 `master` 分支更新时自动运行，也支持在 GitHub Actions 中手动触发。发布前在本地完成一次集中验证；工作流构建静态网站并部署到 GitHub Pages。构建或部署失败时保留上一份已上线版本。

网站只包含网页、运行资源和许可证。Pages 直接提供静态文件，游戏规则、模型绘制、声音与存档在浏览器中运行。在线版与 Windows 便携版使用各自的浏览器存储，继续远征时使用同一个网址和浏览器。

## 本地构建与预览

使用 Node.js 22 或更新版本，在项目根目录运行：

```sh
npm test
npm run verify
npm run build:pages
npm run preview:pages
```

默认输出目录为 `out/github-pages`，已由 Git 忽略。预览地址为 `http://127.0.0.1:4187/mindrealm-bastion/`，使用该端口的浏览器存储。

可指定独立输出目录及部署路径：

```sh
npm run build:pages -- --base-path /mindrealm-bastion/ --output /absolute/path/to/pages-output
npm run preview:pages -- --directory /absolute/path/to/pages-output --port 4187
```

构建工具只覆盖带有本项目网站清单的输出目录。仓库内的输出必须位于 `out/` 子目录，其他源码目录受到保护。

## 路径与资源

`build-pages.mjs` 复用资源清单的运行时文件列表，将网页中的 `/web/`、`/assets/` 以及模型索引的根路径转换为 `/mindrealm-bastion/` 下的地址。转换发生在构建产物中，本地源码和便携包继续使用原路径。

网站根目录的 `index.html` 是游戏入口。`site-manifest.json` 记录游戏版本、部署提交、部署路径、文件大小和 SHA-256；`.nojekyll` 保留原始静态目录。新增动态素材时，须同步维护资源登记与哈希清单。

菜单 PV 通过 `PV_ASSETS` 登记视频、封面和许可文件。它们随网站和 Windows 便携包共同发布。播放器点击后才设置视频地址，视频请求使用部署子目录。开发与本地预览服务支持 `video/mp4` 和字节范围请求，以便播放及拖动进度。

## 验证范围

`pages.test.mjs` 检查子目录路径、模型与音频文件访问、重复构建、原文件保持一致，以及输出目录保护。`browser-pages.js` 通过 Playwright CLI 检查主菜单、新局取消、种子、心神枢纽、路线、继续游戏、战斗与 48 幅叙事插画。

浏览器验证只允许独立本机端口或本站，脚本新建独立浏览器上下文并在结束后关闭。正式版本忽略 `qa=1`，页面没有调试接口。截图和验证结果保存到项目外的临时目录。

`browser-pv.js` 检查按需加载、真实视频解码、暂停、进度、全屏、退出、音乐恢复、失败重试和存档保持。上线后使用同一脚本的精简分支，检查实际页面的播放与资源子路径。
