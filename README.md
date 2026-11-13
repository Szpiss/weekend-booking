# 周末出逃计划 · 私人邀约版

一个轻松表达出游想法的小网站。HTML、CSS、JavaScript + Supabase Auth / PostgreSQL / RLS，部署在 GitHub Pages。

- 预约：https://szpiss.github.io/weekend-booking/
- 后台：https://szpiss.github.io/weekend-booking/admin.html

## 这版可以做什么

- 奶油绿旅行手帐风格，9 张原创 SVG 插画，兼容手机、平板和电脑。
- 8 种参考灵感：森林、街区漫游、咖啡、野餐、日落、看展、美食、周边小镇。按主题、时长和预算筛选，收藏、随机抽取，查看参考时间线、准备清单和天气备选。可以同时选择最多 8 个灵感、逐项移除或清空，再一起带入预约。
- 三步表达：出游心愿 → 说两句话 → 确认一下。日期可以留空，交通和预算可以商量，也能明确选择带朋友或先聊聊。意愿选项没有默认答案，必须主动选择。
- 只有最后明确点击发送才保存预约。浏览、收藏、婉拒和未发送的表单不写入预约库；收藏仅保存公开的灵感 ID，不保存联系方式、留言或填写草稿。
- 提交成功后显示参考号；有明确时间的意向可下载标为 TENTATIVE 的日历文件，日历不包含联系方式或私密留言。
- 管理员查询完整记录、按任意一个已选方案/日期/状态筛选、按日期排序、修改处理状态和导出 CSV；「先聊聊」与「愿意出门」作为不同意愿保留。
- 后台可填写双方称呼、一句话和推荐方案，生成专属邀请链接，由管理员自行发送。称呼和文案存于 URL fragment，不另存数据库、不跟踪打开；拿到链接的人可见这些内容。对方仍须自主选择和明确提交。

卡片是参考灵感，不是已成团活动。金额是粗略预算，不是报名费或报价，不收款、不自动订票，也不保证场馆可约、天气或成行。

## 管理员使用

使用单独交付的站点账号登录后台，与 Supabase 控制台账号无关。可在后台「修改管理员密码」设置新密码。查看详情可看到意愿、方案、预算、交通、相处方式、留言和提交参考号。

CSV 导出当前筛选结果，要导出全部先清除筛选。文件包含 UTF-8 BOM，处理引号、换行及公式注入。退出登录会清空预约 DOM、详情和生成的链接；会话保存在当前标签页的 sessionStorage。

专属邀请：展开「写一张专属邀请」，填写称呼、文案和推荐方案，生成后复制链接或预览。请勿在文案或称呼中填写私人联系方式；这不是限指定收件人访问的加密链接。

## 修改内容

- 活动灵感：编辑 `assets/catalog.js`；`id` 保持稳定。这里管理标题、插画、分类、预算区间、参考路线、准备清单和天气备选。
- 页面文案：`index.html`。新前台样式：`assets/club.css`；新后台样式：`assets/admin-v2.css`。`assets/styles.css` 保留基础表单样式。
- 插画：`assets/illustrations/`，独立原创 SVG，页面不依赖外部图片/CDN/字体服务。
- 修改后执行 `python3 scripts/version-assets.py`，再提交，避免浏览器缓存旧 CSS 或 JS。
- 发布前先检查，并取得网站所有者的明确上线许可；推送 main 会触发 GitHub Pages。

## 数据库和安全

项目 ID：`rmefpkyslcfljrkkmndx`，新加坡区域。

- 新建空库使用 `database.sql`；已有 v1 库先使用 `database-v2.sql`，已有 v2 库增加多选使用 `database-multiselect.sql`。当前项目已应用这些升级，不要重复运行。
- 两表均启用 RLS，匿名只可 INSERT 允许的字段，无 SELECT / UPDATE / DELETE。前端仅使用公开 publishable key。
- 普通登录身份不会自动成为管理员；只有 `site_admins` 中的 UUID 可以 SELECT 和 `UPDATE(status)`，不能改意愿或个人资料。授权表不能被浏览器角色写入。
- 字段长度、枚举、人数、日期、手机号、同意标记和蜜罐由 SQL 校验；联系方式维度每小时最多 3 份、每日最多 10 份，以事务锁防并发绕过。
- request_id 防重试重复；相同联系方式、目的地、日期和时间段的未取消预约唯一，日期为 NULL 时同样防重。
- 私有触发器固定空 search_path，撤销浏览器角色执行权限。预约不使用 localStorage 持久化。
- `config.js` 仅有项目 URL 和 publishable key，禁止加入 service_role、secret key、数据库密码或管理员密码。

新增管理员须由项目所有者在 Supabase Auth 创建并确认账号，再明确授予成员身份：

```sql
insert into public.site_admins(user_id)
select id from auth.users
where lower(email)=lower('替换为管理员邮箱') and email_confirmed_at is not null
on conflict do nothing;
```

从成员表删除对应 UUID 即可撤销权限。不会仅依赖前端隐藏按钮。

## 参考与独立实现

借鉴 [AdventureLog](https://github.com/seanmorley15/AdventureLog) 的行程组织思路、[Hi.Events](https://github.com/HiEventsDev/Hi.Events) 的活动详情与报名体验、[Promptrip](https://github.com/sergfv/promptrip) 的轻量静态交互思路。本项目代码和插画独立实现，未复制这些项目的源码、品牌或素材。

## 本地检查

```sh
python3 -m http.server 8080
node --check assets/app.js
node --check assets/admin.js
node --check assets/catalog.js
python3 scripts/version-assets.py
```

本地预览同样连接 `config.js` 中的真实数据库。测试使用明确标记的虚构资料并精确清理，保留原有预约。

现有基础防垃圾措施不等同于验证码或可信 IP 限流。Supabase 泄露密码检测尚未启用；实体手机、微信内置浏览器和跨地区网络仍需额外验证。V1 历史验收见 `VERIFICATION.md`，本次改造见 `V2_VERIFICATION.md`。

## 多选数据兼容

`selected_plans` 使用 JSONB 数组保存完整的灵感 ID 和标题快照，最多 8 项，并在数据库校验结构、ID、标题和总体长度。`plan_id` / `plan_title` 继续保留第一项以兼容旧版；新后台优先使用完整数组，旧预约使用原单选字段回退显示。后台方案筛选匹配列表中任意一项，CSV 同一单元格包含全部已选标题。

新增灵感不会覆盖用户手动改过的地点、时间、预算或节奏；新增/移除会回到第一步重新确认。多选草稿仅保留在页面内存，不写入 localStorage，最终发送才入库。多选及微信网络处理共同测试可运行 `node --test tests/*.test.cjs`。
