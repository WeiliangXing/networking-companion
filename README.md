# Networking Companion

一个用于线下交流的浏览器语音 Agent。访客可以和 3D 机器人对话、听团队介绍、浏览业务演示，或留下联系方式。会后可以查看笔记和跟进邮件草稿。团队介绍在 src/profile.js、src/joanna-background.js 和 src/professional-introduction.js 中维护。

## 在 Mac 上运行

1. 安装 Node.js 24 和 npm。用以下命令下载项目并安装锁定版本的依赖。
   
   ```sh
   git clone https://github.com/WeiliangXing/networking-companion.git
   cd networking-companion
   node --version
   npm ci
   cp .dev.vars.example .dev.vars
   ```

2. 编辑项目根目录的 `.dev.vars`。把 `OWNER_CODE` 换成自己登录网页用的口令，把 `SESSION_SECRET` 换成运行 `openssl rand -hex 32` 得到的随机字符串。保留每个值外侧的双引号。要体验语音和联网研究，将自己的 OpenAI API key 填入 `OPENAI_API_KEY`。留空也可以测试登录和联系人保存。模型名称在 `wrangler.jsonc` 中配置。邮件发送默认关闭。

3. 初始化本地 D1 数据库，再启动应用。首次运行以及更新代码后执行迁移。
   
   ```sh
   npx wrangler d1 migrations apply networking-companion --local
   npm run dev
   ```

4. 打开 **http://localhost:5203**，使用刚设置的口令解锁。点击 **Start**，允许浏览器使用麦克风，试着说“介绍一下你的团队”。点击 **Stop** 结束。业务展示页也可以直接打开 **http://localhost:5203/business/**。终端按 Ctrl+C 可停止服务器，下次进入项目目录运行 `npm run dev` 即可。本地数据库保存在 `.wrangler/state/`。

## 验证

在另一个终端进入同一目录，使用 Node.js 24 执行以下命令。

```sh
npm test
node test/local-flow.mjs
```

第一条运行单元测试。第二条要求本地服务已启动、数据库已迁移、邮件发送关闭，用合成联系人验证登录、访客交接、保存和结束会话。默认端口为 5203，可通过 LOCAL_TEST_PORT 指定其他本地测试端口。两项验证均可在 API key 留空时运行。

## 部署自己的 Cloudflare Worker（可选）

先运行 `npx wrangler login`，再执行 `npx wrangler d1 create networking-companion`。把返回的 database_id 填入 wrangler.jsonc，保留绑定名 DB，并将 Worker 的 name 改为自己的服务名。运行以下命令，按提示逐个输入线上密钥。

```sh
npx wrangler d1 migrations apply networking-companion --remote
npm run deploy
npx wrangler secret put OWNER_CODE
npx wrangler secret put SESSION_SECRET
npx wrangler secret put OPENAI_API_KEY
```

打开部署输出中的 HTTPS 地址，使用线上口令测试。线上数据库与本地数据库独立。开启实时语音需要账号有权使用所配置的模型。实际麦克风、扬声器及会场噪声下的效果需要在使用设备上验证。
