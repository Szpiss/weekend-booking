# 周末出逃计划 · weekend-booking

基于原项目继续开发，HTML / CSS / JavaScript + Supabase PostgreSQL、Auth、RLS + GitHub Pages。

- 预约：https://szpiss.github.io/weekend-booking/
- 后台：https://szpiss.github.io/weekend-booking/admin.html
- 仓库：https://github.com/Szpiss/weekend-booking

## 日常操作

访客填写昵称、联系方式、目的地、日期、时间段、人数、偏好和留言，勾选信息使用说明后提交。记录直接写入 Supabase 数据库，浏览器不保存预约数据。发起人联系确认后才确定行程。

使用单独交付的站点管理员邮箱和初始密码登录 `admin.html`；这不是 Supabase 控制台账号。建议首次登录后展开底部「修改管理员密码」自行改密。后台支持关键词、预约日期和状态组合筛选；选择待处理、已确认、已取消即可保存状态。点击「导出 CSV」导出当前筛选结果，清除筛选后导出全部。退出会清除页面数据，会话只保存在当前标签页的 sessionStorage。

## 修改活动信息

编辑 `index.html` 的标题、说明与文案，样式在 `assets/styles.css`；提交到 `main` 后自动发布。所有资源使用相对路径，支持 GitHub Pages 子路径。日期为中国时区今天起一年内，人数 1–8。修改时间段或偏好的取值时，需要同步更改 HTML、JavaScript 和数据库约束；单改显示文案则无需变更数据库。

## 数据权限

Supabase 项目：`weekend-booking`，新加坡区域。`database.sql` 是新项目的初始脚本，对应 `create_booking_schema_and_rls` 迁移，不是重复执行的升级脚本。

- `outing_reservations` 持久化预约，`site_admins` 按 Auth 用户 UUID 授权；两表均启用 RLS。
- `anon` 仅可 INSERT 允许的预约字段，无 SELECT / UPDATE / DELETE 权限，不能伪造状态或提交时间。
- `authenticated` 具有 SELECT 和 `UPDATE(status)` 权限，RLS 进一步检查该用户是否在 `site_admins`。普通登录用户无法读取记录或修改数据，也不能提升自身权限。
- 管理员仅可查询和更改状态，不能通过网页删除记录或修改成员权限。
- 私有 schema 内部触发器固定空 search_path，撤销浏览器角色的函数执行权限。触发器检查日期、手机号，并通过事务锁串行限制同一联系方式每小时 3 份、每日 10 份。
- 数据库约束检查长度、人数、偏好、同意和蜜罐字段。请求 UUID 防止网络重试重复；同一联系方式、目的地、日期和时间段的未取消行程唯一。
- CSV 包含 UTF-8 BOM，正确转义逗号、引号、换行，并处理潜在的电子表格公式注入。

新增管理员：由项目所有者先在 Supabase Authentication 创建并确认账号，再在 SQL Editor 执行：

```sql
insert into public.site_admins(user_id)
select id from auth.users
where lower(email)=lower('替换为管理员邮箱') and email_confirmed_at is not null
on conflict do nothing;
```

从 `site_admins` 删除对应 UUID 即撤销其权限，RLS 每次请求均检查成员表。不要开放成员管理写权限给网页用户。

`config.js` 只包含允许公开的项目 URL 和 publishable key。绝不能放入 service_role、secret key、数据库密码或管理员密码。个人管理员邮箱和凭据不在仓库内。

首次创建账号使用了带随机令牌与过期时间的一次性服务端初始化函数。完成后立即替换为无功能的 410 响应并恢复 JWT 校验，当前不包含令牌或账号创建逻辑；正常预约不使用此函数。

## 防滥用范围

已有数据库校验、联系方式维度限流、重复检测和蜜罐。提交者可以更换联系方式，因此这属于基础防护；持续机器人攻击需要额外的验证码和可信服务端 IP 限流。不要把预约 CSV 或管理员登录文件上传到公开仓库。

## 部署和维护

GitHub Pages 从 `main` 根目录发布，`.nojekyll` 禁用 Jekyll。Supabase JS 固定为 2.119.0，托管于 `assets/vendor/`，附 MIT 许可，无运行时 CDN 或 Google Fonts 依赖。

```sh
python3 -m http.server 8080
node --check assets/app.js
node --check assets/admin.js
```

本地预览同样连接真实数据库，仅使用明确标记的虚构测试信息并及时清理。免费项目可能受平台暂停策略影响，连接失败时检查 Supabase 控制台健康状态。实际部署验收证据见 `VERIFICATION.md`。
