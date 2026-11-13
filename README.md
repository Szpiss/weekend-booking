# 周末出逃计划 · 出游预约网页

一套可部署在 GitHub Pages 的静态网站，搭配 Supabase 托管数据库、管理员身份验证和数据库行级权限（RLS）。

## 功能

- 访客：响应式活动预约、联系方式、目的地、日期、人数、偏好、备注、信息使用同意、提交反馈。
- 管理员：邮箱密码登录、查看所有真实预约、搜索与筛选、标记为已确认/已取消、CSV 导出。
- 数据权限：未登录访客只可写入新预约，不能读取他人的预约；后台读写需管理员授权。

## 重要限制

**首次下载时并未连接真实数据库，提交按钮默认禁用。** 必须配置 Supabase 后才会真正接收预约。GitHub Pages 本身不提供数据库或服务端。

## 一、配置 Supabase

1. 在 https://supabase.com/dashboard 创建自己的项目。
2. 进入 `SQL Editor`，粘贴并运行项目根目录下的 `database.sql`，确认无报错。
3. 在 `Authentication → Users` 创建你自己的管理员账号，设置强密码，并确认邮箱已经验证。建议关闭公共自助注册。
4. 再进入 `SQL Editor`，把下面 SQL 的邮箱替换为你自己的管理员邮箱，执行并检查返回至少 1 行：

```sql
insert into public.site_admins(user_id)
select id from auth.users where email = '你的管理员邮箱@example.com'
on conflict (user_id) do nothing;

select user_id from public.site_admins;
```

5. 在 Supabase 项目 `Project Settings → API`（不同版本界面位置可能调整）找到项目 URL 和 Publishable key（或者旧版 anon public key），填写到 `config.js`：

```js
window.SITE_CONFIG = {
  supabaseUrl: "https://your-project.supabase.co",
  supabasePublishableKey: "sb_publishable_..."
};
```

**绝对不要填入 `service_role` key 或 `secret` key。** `config.js` 会被公开访问。公开的 Publishable/anon key 在 RLS 和权限正确配置时才适合前端。

## 二、部署 GitHub Pages

1. GitHub 创建一个**新仓库**（建议名 `weekend-booking`），设为 Public。
2. 将本项目中的 `index.html`, `admin.html`, `config.js`, `database.sql`, `.nojekyll`, `assets/`, `README.md` 上传到仓库根目录，提交到 `main` 分支。`database.sql` 不包含实际账号凭据。
3. 打开仓库 `Settings → Pages → Build and deployment`，`Source` 选择 **Deploy from a branch**；选择 `main` 分支和 `/(root)`，保存。
4. 等 GitHub Pages 发布后，前台网址通常为：`https://你的用户名.github.io/weekend-booking/`；后台为 `https://你的用户名.github.io/weekend-booking/admin.html`。
5. 公开网址只是通用格式，**以 GitHub Pages 设置页实际显示的站点链接为准**。

## 三、联调与安全检查

- 用无痕窗口进入前台，填写一条测试预约，检查是否显示「预约已送达」。
- 登录后台，应看到刚提交的预约、联系方式，并能够修改状态及导出 CSV。
- **用另一个未登录浏览器尝试读取数据时应该被数据库拒绝**，不是只靠隐藏后台入口。
- 用非管理员账号登录时，应显示「没有管理员权限」。
- 如提交失败，检查浏览器控制台、Supabase API 配置和 `database.sql` 权限政策。

## 四、运营注意事项

- 当前允许匿名公开提交，在面对机器人垃圾数据时仍需要 **验证码、限流或 Supabase Edge Function** 等进一步的服务端防滥用措施。前端蜜罐不是可靠的服务端安全屏障。
- 只收集组织活动所需的最低限度个人信息。不要把后台导出的联系方式 CSV 上传到公开仓库。
- 由于联系方式属于个人信息，建议公开具体联系人、保留期限与删除申请途径。对于公开运营使用，应按实际适用法律和隐私政策进行完善。
- 每次更改 SQL 权限策略后，先做未登录、普通用户、管理员三类权限验证。

## 本地预览

在项目目录运行 `python3 -m http.server 8080`，打开 `http://localhost:8080/`。未配置 Supabase 时可以预览布局，但无法提交预约。

## 目录

```
weekend-booking/
├── index.html               # 访客预约页
├── admin.html               # 管理员后台
├── config.js                # Supabase URL 与公开 key（需要配置）
├── database.sql             # 数据表、RLS、数据库权限
├── assets/
│   ├── styles.css
│   ├── app.js
│   └── admin.js
├── .nojekyll
└── README.md
```

技术参考：
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/reference/javascript/installing
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
