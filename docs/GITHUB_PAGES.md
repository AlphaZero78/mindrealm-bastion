# GitHub Pages 在线版

在线地址：[https://alphazero78.github.io/mindrealm-bastion/](https://alphazero78.github.io/mindrealm-bastion/)。

## 发布流程

`.github/workflows/pages.yml` 在 `master` 分支更新时自动运行，也支持在 GitHub Actions 中手动触发。流程先运行源码测试和资源校验，再构建静态网站并部署到 GitHub Pages。构建或测试失败时保留上一份已上线版本。

网站只包含网页、运行资源和许可证。Pages 直接提供静态文件，游戏规则、模型绘制、声音与存档在浏览器中运行。在线版与 Windows 便携版使用各自的浏览器存储，继续远征时使用同一个网址和浏览器。

## 本地构建与预览

使用 Node.js 22 或更新版本，在项目根目录运行：

```sh
npm test
npm run verify
npm run build:pages
npm run preview:pages
```

默认输出目录为 `out/github-pages`，已由 Git 忽略。预览地址为 `http://127.0.0.1:4187/mindrealm-bastion/?qa=1`，使用内存存档。

可指定独立输出目录及部署路径：

```sh
npm run build:pages -- --base-path /mindrealm-bastion/ --output /absolute/path/to/pages-output
npm run preview:pages -- --directory /absolute/path/to/pages-output --port 4187
```

构建工具只覆盖带有本项目网站清单的输出目录。仓库内的输出必须位于 `out/` 子目录，其他源码目录受到保护。

## 路径与资源

`build-pages.mjs` 复用资源清单的运行时文件列表，将网页中的 `/web/`、`/assets/` 以及模型索引的根路径转换为 `/mindrealm-bastion/` 下的地址。转换发生在构建产物中，本地源码和便携包继续使用原路径。

网站根目录的 `index.html` 是游戏入口。`site-manifest.json` 记录游戏版本、部署提交、部署路径、文件大小和 SHA-256；`.nojekyll` 保留原始静态目录。新增动态素材时，须同步维护资源登记与哈希清单。

## 验证范围

`pages.test.mjs` 检查子目录路径、模型与音频文件访问、重复构建、原文件保持一致，以及输出目录保护。`browser-pages.js` 通过 Playwright CLI 检查主菜单、心神枢纽、路线、实际部署、继续游戏、战斗、音频与 36 幅事件插画。

浏览器验证只允许独立本机端口，或本站的 `?qa=1` 页面。该参数使用内存存档。截图和验证结果保存到项目外的临时目录。
