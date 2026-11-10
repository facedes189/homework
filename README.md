# 个人网页 · faded

《计算机基础》课程设计作品。一个用纯手写 HTML / CSS 搭建的个人网站，共 6 个页面，
托管在代码仓库并通过 Pages 服务发布。

**在线地址：<https://facedes189.github.io/homework/>**
仓库：<https://github.com/facedes189/homework>（发布用） · <https://gitee.com/faded-to-perfection/faded>（源码）

## 目录结构

```
.
├── index.html        首页（主页，Pages 默认访问入口）
├── about.html        个人简介（含 4 个页内锚点）
├── works.html        动画作品（4 个纯 CSS 动效）
├── gallery.html      我的相册（6 张照片 + 灯箱）
├── thoughts.html     学习心得（3 篇短文）
├── notes.html        课程笔记（6 张知识卡片 + 代码示例）
├── css/
│   └── style.css     全站样式（含响应式与无障碍适配）
├── js/
│   └── main.js       滚动淡入、灯箱、页脚日期、表单
└── images/           照片与图标素材
```

## 说明

- **页面数量**：6 个，满足"不少于 5 个"的要求。
- **主页**：`index.html`，页面内包含到其余 5 个分页面的链接（顶部导航 + 左侧栏 + 页内卡片），
  并有一块"本站一览"数据概览，进入视口时数字递增。
- **相对路径**：所有页面、样式、脚本、图片均使用相对路径，整个文件夹拷贝到任何位置、
  或整体上传到 Pages 后都能正常显示。
- **结构参考**：整体沿用传统个人主页的"页头 → 导航条 → 左栏 + 正文 → 页脚"骨架，
  配色保留红 / 蓝 / 白 / 黑，但全部用现代 CSS 重写，未使用任何第三方框架。
- **动效**：四段动画均由 AI 生成，以 `@keyframes` 实现；横幅的云、气球与卡片悬停也用纯 CSS
  完成，并在 `prefers-reduced-motion` 下自动关闭。
- **响应式**：桌面两栏，窄屏自动变为单栏。

## 本地查看

直接双击 `index.html` 即可，无需服务器。

## 发布（Pages）

> 说明：Gitee（码云）的 Pages 服务已于 2024 年下线，仓库设置里已经没有该入口，
> 因此本作品改用 GitHub Pages 发布，步骤与码云 Pages 基本一致（都是选分支 + 选根目录）。

### 路线 A：GitHub Pages（推荐，长期有效）

1. 在 GitHub 新建一个**公开**仓库，例如 `homework`。
2. 给本地仓库加一个 GitHub 远程，并把代码推上去：

   ```bash
   git remote add github git@github.com:你的用户名/homework.git
   git push github master
   ```

3. 打开仓库 `Settings → Pages`，`Source` 选 `Deploy from a branch`，
   分支选 `master`，目录选 `/ (root)`，保存。
4. 等 1–2 分钟，访问 `https://你的用户名.github.io/homework/` 即为首页。
5. 之后每次 `git push github master`，网站会自动更新。

推送前请确认根目录有 `index.html`（本仓库已满足），`.nojekyll` 用于跳过 Jekyll 处理，
避免文件名以下划线开头的资源被忽略。

### 路线 B：Netlify / Cloudflare Pages（不用账号也能先看效果）

打开 <https://app.netlify.com/drop>，把整个项目文件夹（或打包好的 zip）直接拖进页面，
几秒后即可得到一个可访问的网址；注册后可保留该地址并绑定自定义域名。

### 路线 C：只做本机演示

直接双击 `index.html` 即可完整浏览，无需服务器。
若作业要求必须提交公网地址，请使用路线 A 或 B。

