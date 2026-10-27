import "server-only";
import { DEMO_ADMIN, DEMO_PASSWORD } from "@/lib/constants";
import { shouldSeedDemo, transaction, type Sql } from "@/lib/db";
import { excerpt } from "@/lib/format";
import { hashPassword } from "@/lib/password";
import { createReport, resolveReport } from "@/server/writes";

const hour = 3_600_000;

type UserSeed = {
  id: string;
  username: string;
  email: string;
  nickname: string;
  role: "user" | "moderator" | "admin";
  hue: number;
  bio: string;
  mustChange: number;
  hash: string;
};

export async function seedIfEmpty() {
  if (!shouldSeedDemo()) {
    console.info("[巷议] 未开启演示数据（生产模式默认关闭，可用 SEED_DEMO 调整）");
    return;
  }
  const existing = await transaction(async (tx) => {
    const row = await tx.get<{ c: number }>("SELECT COUNT(*) AS c FROM users");
    return Number(row?.c ?? 0);
  });
  if (existing > 0) return;

  const adminHash = await hashPassword(DEMO_ADMIN.password);
  const demoHash = await hashPassword(DEMO_PASSWORD);
  try {
    await transaction(async (tx) => {
      const again = await tx.get<{ c: number }>("SELECT COUNT(*) AS c FROM users");
      if (Number(again?.c ?? 0) > 0) return;
      await insertSeed(tx, adminHash, demoHash);
    });
    console.info("[巷议] 已写入演示版块、主题和账号");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const left = await transaction(async (tx) => {
      const row = await tx.get<{ c: number }>("SELECT COUNT(*) AS c FROM users");
      return Number(row?.c ?? 0);
    }).catch(() => 0);
    if (left > 0 && /unique|duplicate/i.test(message)) {
      console.info("[巷议] 演示数据已存在");
      return;
    }
    const safe = message.replace(/postgres(ql)?:\/\/\S+/gi, "[redacted]");
    console.error(`[巷议] 写入演示数据失败：${safe}`);
    throw error;
  }
}

async function insertSeed(tx: Sql, adminHash: string, demoHash: string) {
  const now = Date.now();
  const ago = (hours: number) => now - Math.round(hours * hour);
  const users: UserSeed[] = [
    { id: "usr_admin", username: "admin", email: DEMO_ADMIN.email, nickname: "陈衡", role: "admin", hue: 152, bio: "巷议站长。负责版务，也负责把服务器按时叫醒。", mustChange: 1, hash: adminHash },
    { id: "usr_lin", username: "lin", email: "lin@xiangyi.local", nickname: "小林", role: "moderator", hue: 200, bio: "技术交流版主。喜欢把问题写清楚再动手。", mustChange: 1, hash: demoHash },
    { id: "usr_he", username: "he", email: "he@xiangyi.local", nickname: "阿禾", role: "user", hue: 28, bio: "在上海做设计，周末会骑车。", mustChange: 1, hash: demoHash },
    { id: "usr_su", username: "su", email: "su@xiangyi.local", nickname: "苏晚", role: "user", hue: 330, bio: "编辑。最近在重读八十年代的小说。", mustChange: 1, hash: demoHash },
    { id: "usr_zhao", username: "zhao", email: "zhao@xiangyi.local", nickname: "老赵", role: "user", hue: 45, bio: "写了十几年后端，现在带两个实习生。", mustChange: 1, hash: demoHash },
    { id: "usr_miao", username: "miao", email: "miao@xiangyi.local", nickname: "苗苗", role: "user", hue: 280, bio: "刚毕业，正在学做饭，也在学把报错读完。", mustChange: 1, hash: demoHash },
    { id: "usr_qiao", username: "qiao", email: "qiao@xiangyi.local", nickname: "乔安", role: "user", hue: 190, bio: "播客听众，偶尔自己录音。", mustChange: 1, hash: demoHash },
    { id: "usr_guang", username: "guang", email: "guang@xiangyi.local", nickname: "优惠君", role: "user", hue: 12, bio: "", mustChange: 1, hash: demoHash },
  ];
  const visit = ago(36);
  for (const user of users) {
    await tx.run(
      `INSERT INTO users (
        id, username, email, password_hash, nickname, bio, avatar_hue, role, must_change_password,
        created_at, last_seen_at, last_visit_at, prev_visit_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.username, user.email, user.hash, user.nickname, user.bio, user.hue, user.role, user.mustChange, ago(400), visit, visit, visit],
    );
  }

  const boards = [
    ["brd_notice", "notice", "站务公告", "站点规则、维护通知和重要说明。", 0],
    ["brd_general", "general", "综合讨论", "没有明确分类的话题，放在这里就好。", 1],
    ["brd_tech", "tech", "技术交流", "编程、工具、排版和工程实践。", 2],
    ["brd_culture", "culture", "读书影音", "书、电影、音乐和播客。", 3],
    ["brd_life", "life", "生活闲聊", "天气、吃饭、城市和日常。", 4],
  ] as const;
  for (const [id, slug, name, description, sort] of boards) {
    await tx.run(
      "INSERT INTO boards (id, slug, name, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, slug, name, description, sort, ago(500 - sort)],
    );
  }

  const threadRows: unknown[][] = [];
  const postRows: unknown[][] = [];
  const noteRows: unknown[][] = [];
  const threadById = new Map<string, { authorId: string; title: string }>();
  const nick = Object.fromEntries(users.map((user) => [user.id, user.nickname]));

  const thread = async (input: { id: string; postId: string; authorId: string; boardId: string; title: string; content: string; hours: number }) => {
    const created = ago(input.hours);
    threadRows.push([
      input.id, input.boardId, input.authorId, input.title,
      0, 0, 0, 0, created, created, created, input.authorId,
    ]);
    postRows.push([input.postId, input.id, input.authorId, null, input.content, 1, created, created]);
    threadById.set(input.id, { authorId: input.authorId, title: input.title });
  };
  const reply = async (input: { id: string; threadId: string; authorId: string; parentId: string; content: string; hours: number; notify?: boolean }) => {
    const created = ago(input.hours);
    postRows.push([input.id, input.threadId, input.authorId, input.parentId, input.content, 0, created, created]);
    if (!input.notify) return;
    const meta = threadById.get(input.threadId);
    const parentAuthor = String(postRows.find((row) => row[0] === input.parentId)?.[2] ?? "");
    const preview = excerpt(input.content, 80);
    const href = `/threads/${input.threadId}#post-${input.id}`;
    const actorName = nick[input.authorId] ?? "有人";
    if (parentAuthor && parentAuthor !== input.authorId) {
      noteRows.push([
        `ntf_${input.id}`, parentAuthor, input.authorId, "reply",
        `${actorName} 回复了你`, preview, href, null, created,
      ]);
    }
    if (meta && meta.authorId !== input.authorId && meta.authorId !== parentAuthor) {
      noteRows.push([
        `ntf_${input.id}_t`, meta.authorId, input.authorId, "reply_thread",
        `${actorName} 回复了你的主题`, `《${meta.title}》${preview}`, href, null, created,
      ]);
    }
  };

  await thread({
    id: "thr_rules",
    postId: "pst_rules",
    authorId: "usr_admin",
    boardId: "brd_notice",
    hours: 240,
    title: "欢迎来到巷议：发帖之前请读这几条",
    content: `欢迎来到巷议。这里按版块讨论，回复可以嵌套，方便把一条线索说完。

发帖之前，请先记住这几条：

1. 一对一事，标题写清楚，不必加「求助」「在线等」之类的前缀。
2. 可以反驳观点，不要攻击人。
3. 广告、引流和重复灌水会被隐藏或删除。
4. 主题被锁定后，普通会员不能再回复。
5. 看到不合适的内容，用「举报」，不必在楼里对骂。

站务问题可以在本版留言，其他话题请发到对应版块。本帖已锁定。`,
  });
  await reply({
    id: "pst_rules_lin",
    threadId: "thr_rules",
    authorId: "usr_lin",
    parentId: "pst_rules",
    hours: 200,
    content: "技术版我会按这个尺度处理：把话说完可以，人身攻击和广告会隐藏。",
  });

  await thread({
    id: "thr_books",
    postId: "pst_books",
    authorId: "usr_su",
    boardId: "brd_general",
    hours: 20,
    title: "大家怎么给家里的书找位置？",
    content: "两面墙已经到顶了，新买的书开始堆在地上。不想再买一套看起来很满、实际取书要搬凳子的柜子。你们是怎么收的？",
  });
  await reply({ id: "pst_books_he", threadId: "thr_books", authorId: "usr_he", parentId: "pst_books", hours: 19, content: "我后来把不常翻的书横放，只让在读的那一排竖着。看起来没那么「满」，取书也快。" });
  await reply({ id: "pst_books_su", threadId: "thr_books", authorId: "usr_su", parentId: "pst_books_he", hours: 18, content: "横放这个我试过，纸面书会压出印。精装还好，平装我有点舍不得。" });
  await reply({ id: "pst_books_zhao", threadId: "thr_books", authorId: "usr_zhao", parentId: "pst_books", hours: 17, content: "这种书架问题每年都有人问。先量一下墙的承重，再决定要不要买通顶的柜子，别一上来就问「求推荐」。" });
  await reply({ id: "pst_books_miao", threadId: "thr_books", authorId: "usr_miao", parentId: "pst_books_zhao", hours: 16, content: "承重这点有用。不过后面那句有点冲，人家就是在问做法。" });
  await reply({ id: "pst_books_zhao2", threadId: "thr_books", authorId: "usr_zhao", parentId: "pst_books_miao", hours: 15.5, content: "冲的是我，撤回后半句。先量墙，再谈柜子，这句我认。" });
  await reply({ id: "pst_books_qiao", threadId: "thr_books", authorId: "usr_qiao", parentId: "pst_books", hours: 15, content: "我把已经读完、不打算再翻的送给社区图书馆。架子空出来的速度比买柜子快。" });
  await reply({ id: "pst_books_lin", threadId: "thr_books", authorId: "usr_lin", parentId: "pst_books", hours: 14.5, content: "电子版和纸书分开统计，不然永远觉得自己「还缺一个柜子」。" });
  await reply({ id: "pst_books_admin", threadId: "thr_books", authorId: "usr_admin", parentId: "pst_books", hours: 14, content: "站务也提醒一句：求推荐可以，贴购买链接请标明是不是广告。" });
  await reply({ id: "pst_books_he2", threadId: "thr_books", authorId: "usr_he", parentId: "pst_books", hours: 13.5, content: "补充一个：靠窗的那排别放平装，上海的回南天会把书页吹皱。", notify: true });

  await thread({
    id: "thr_sqlite",
    postId: "pst_sqlite",
    authorId: "usr_zhao",
    boardId: "brd_tech",
    hours: 55,
    title: "用 SQLite 撑一个小论坛，边界在哪？",
    content: `如果只是版块不多、每天几百条回复，我会先用 SQLite，而不是一上来就摆一套数据库集群。想听听你们的边界。

我自己的判断：

- 写入集中在一个进程里，要水平扩展之前就该换
- 备份可以是复制文件，记得带上 WAL
- 中文全文检索会先变得别扭

有人在生产里用它撑过社区吗？`,
  });
  await reply({
    id: "pst_sqlite_lin",
    threadId: "thr_sqlite",
    authorId: "usr_lin",
    parentId: "pst_sqlite",
    hours: 52,
    content: "小论坛的瓶颈经常是垃圾内容和通知，不是查询。SQLite 够用到你需要多个写入实例的那天。真到了那一步，再迁也不迟，别把迁移剧本提前写成架构。",
  });
  await reply({ id: "pst_sqlite_qiao", threadId: "thr_sqlite", authorId: "usr_qiao", parentId: "pst_sqlite_lin", hours: 50, content: "所以「先跑起来」是正经方案，不是偷懒？" });
  await reply({ id: "pst_sqlite_admin", threadId: "thr_sqlite", authorId: "usr_admin", parentId: "pst_sqlite", hours: 48, content: "本站本地演示就是这个思路：没有 DATABASE_URL 时用 SQLite，配了连接串就走 Postgres。同一套迁移。" });

  await thread({
    id: "thr_wang",
    postId: "pst_wang",
    authorId: "usr_su",
    boardId: "brd_culture",
    hours: 30,
    title: "重读汪曾祺《受戒》，想抄一句给你们看",
    content: "「英子跳到中舱，两只桨飞快地划起来，划进了芦花荡。」我年轻时觉得这是风景，现在觉得他是在写一个人决定把日子过轻一点。你们重读时停在哪一句？",
  });
  await reply({ id: "pst_wang_qiao", threadId: "thr_wang", authorId: "usr_qiao", parentId: "pst_wang", hours: 28, content: "我停在吃粽子的那几行。他写食物的时候，人是坐得住的。" });
  await reply({ id: "pst_wang_he", threadId: "thr_wang", authorId: "usr_he", parentId: "pst_wang_qiao", hours: 26, content: "坐得住这词好。现在很多句子急着表态，他不急。", notify: true });

  await thread({
    id: "thr_weather",
    postId: "pst_weather",
    authorId: "usr_he",
    boardId: "brd_life",
    hours: 16,
    title: "上海这周终于有一点秋天的意思",
    content: "早上骑车不用把袖子卷到肩膀了。苏州河那边的风是干的。有人和我一样觉得这周才算入秋吗？",
  });
  await reply({ id: "pst_weather_miao", threadId: "thr_weather", authorId: "usr_miao", parentId: "pst_weather", hours: 15, content: "办公室空调还在吹夏天。一出门就觉得你说得对。" });
  await reply({ id: "pst_weather_spam", threadId: "thr_weather", authorId: "usr_guang", parentId: "pst_weather", hours: 14.5, content: "加微信领优惠券，日入过万，不看后悔。名额有限，速来。" });
  await reply({ id: "pst_weather_su", threadId: "thr_weather", authorId: "usr_su", parentId: "pst_weather", hours: 14, content: "梧桐开始掉叶子了，不过晚上还是闷。算半个秋天。", notify: true });

  await thread({
    id: "thr_type",
    postId: "pst_type",
    authorId: "usr_he",
    boardId: "brd_tech",
    hours: 12,
    title: "中文网页里，我最在意的几处排版",
    content: `做中文页面时，我会先看这几件事：

- 正文行高至少 1.7，不要用 13 像素
- 标点别掉到行首，\`line-break: strict\` 值得写
- 长英文和链接要允许断开，不然手机会被撑破
- 时间用北京时间，别把 UTC 直接甩给读者

你们还会加什么？`,
  });
  await reply({ id: "pst_type_lin", threadId: "thr_type", authorId: "usr_lin", parentId: "pst_type", hours: 11, content: "再加一条：按钮和输入框的可点区域别小于 40 像素。中文标签往往比英文长，挤在一起就像误触。" });
  await reply({ id: "pst_type_zhao", threadId: "thr_type", authorId: "usr_zhao", parentId: "pst_type_lin", hours: 10, content: "我们实习生第一次交页面，行高是 1.2。我让他先把行高改了再谈组件库。" });
  await reply({ id: "pst_type_lin2", threadId: "thr_type", authorId: "usr_lin", parentId: "pst_type_zhao", hours: 9, content: "对。组件库解决不了「这段话读起来累」。先让句子能呼吸。", notify: true });

  await thread({
    id: "thr_shop",
    postId: "pst_shop",
    authorId: "usr_qiao",
    boardId: "brd_general",
    hours: 8,
    title: "周六下午，有人想一起逛独立书店吗？",
    content: "想去静安寺附近那两家，不买也行，主要是想离开屏幕。下午两点门口见。来的人回这楼下一层就好，别另开主题。",
  });
  await reply({ id: "pst_shop_su", threadId: "thr_shop", authorId: "usr_su", parentId: "pst_shop", hours: 7.5, content: "我去。两点我在门口，穿灰外套。" });
  await reply({ id: "pst_shop_miao", threadId: "thr_shop", authorId: "usr_miao", parentId: "pst_shop", hours: 7, content: "我可能晚十分钟，先占个坑。" });
  await reply({ id: "pst_shop_he", threadId: "thr_shop", authorId: "usr_he", parentId: "pst_shop", hours: 6.5, content: "我骑车过去，可以帮人带一本不重的。" });
  await reply({ id: "pst_shop_zhao", threadId: "thr_shop", authorId: "usr_zhao", parentId: "pst_shop", hours: 6, content: "周六要看实习生的周报，去不了。帮我看看有没有汪曾祺的小册子。" });
  await reply({ id: "pst_shop_lin", threadId: "thr_shop", authorId: "usr_lin", parentId: "pst_shop_zhao", hours: 5.5, content: "周报可以周日看。书店不等人。" });
  await reply({ id: "pst_shop_qiao", threadId: "thr_shop", authorId: "usr_qiao", parentId: "pst_shop", hours: 5, content: "先按四人算。下雨也去，店里够站。", notify: true });

  await thread({
    id: "thr_podcast",
    postId: "pst_podcast",
    authorId: "usr_miao",
    boardId: "brd_culture",
    hours: 80,
    title: "求推荐适合通勤听的中文播客",
    content: "单程四十分钟，不想听太吵的访谈，也不想听纯新闻。有没有声音干净、一期能听完的？",
  });
  await reply({
    id: "pst_podcast_qiao",
    threadId: "thr_podcast",
    authorId: "usr_qiao",
    parentId: "pst_podcast",
    hours: 76,
    content: "优先找 25 到 40 分钟的。太长的节目会让你在地铁口舍不得停，结果上班迟到。我可以按这个长度再列三档。",
  });
  await reply({ id: "pst_podcast_zhao", threadId: "thr_podcast", authorId: "usr_zhao", parentId: "pst_podcast_qiao", hours: 74, content: "别推荐一开口就喊「家人们」的。苗苗说的是通勤，不是早市。" });

  await thread({
    id: "thr_pork",
    postId: "pst_pork",
    authorId: "usr_miao",
    boardId: "brd_life",
    hours: 6,
    title: "红烧肉第二次，糖色还是过了",
    content: "冰糖炒到变色我就慌，结果颜色深、味道苦。肉是烂的，糖是错的。有没有「颜色到这里就停」的土办法？",
  });
  await reply({ id: "pst_pork_he", threadId: "thr_pork", authorId: "usr_he", parentId: "pst_pork", hours: 5, content: "看泡沫，不看勇气。泡沫变小、颜色像红茶的时候就下肉。你上次多半是熬成了可乐。" });
  await reply({ id: "pst_pork_miao", threadId: "thr_pork", authorId: "usr_miao", parentId: "pst_pork_he", hours: 4, content: "红茶这个比喻我记住了。我之前一直等到像酱油。" });
  await reply({ id: "pst_pork_zhao", threadId: "thr_pork", authorId: "usr_zhao", parentId: "pst_pork_miao", hours: 3.2, content: "糖色这事急不得。火候小一点，人离开锅三十秒也不会怎样。" });
  await reply({ id: "pst_pork_zhao2", threadId: "thr_pork", authorId: "usr_zhao", parentId: "pst_pork", hours: 3, content: "另外：别一次做三斤给自己壮胆。先做一斤，错了也不心疼。", notify: true });

  await thread({
    id: "thr_git",
    postId: "pst_git",
    authorId: "usr_miao",
    boardId: "brd_tech",
    hours: 100,
    title: "【已解决】怎样避免把本地数据库提交进仓库",
    content: "我不小心把本地的数据库文件加进了第一次提交。现在想把它从仓库里拿掉，又不想删掉自己电脑上的文件。",
  });
  await reply({
    id: "pst_git_lin",
    threadId: "thr_git",
    authorId: "usr_lin",
    parentId: "pst_git",
    hours: 98,
    content: "把数据库目录写进 \`.gitignore\`，然后从版本库里移除文件、保留工作区。连接串放 \`.env.local\`，仓库里只留 \`.env.example\` 的占位符。",
  });
  await reply({ id: "pst_git_miao", threadId: "thr_git", authorId: "usr_miao", parentId: "pst_git_lin", hours: 96, content: "按这个做完了，文件还在，仓库里没有了。主题可以锁了。" });

  await thread({
    id: "thr_tea",
    postId: "pst_tea",
    authorId: "usr_zhao",
    boardId: "brd_life",
    hours: 4,
    title: "办公室的茶叶快喝完了，求平价口粮茶",
    content: "不要礼盒，也不要香精味。上午泡一壶，下午还能再续一次的那种。预算两位数。",
  });
  await reply({ id: "pst_tea_admin", threadId: "thr_tea", authorId: "usr_admin", parentId: "pst_tea", hours: 3.4, content: "黄山的炒青，超市就有。别买碎末太多的，否则第二泡是苦的。" });
  await reply({ id: "pst_tea_su", threadId: "thr_tea", authorId: "usr_su", parentId: "pst_tea_admin", hours: 2.5, content: "同意。另外别用刚烧开的水闷着，稍微凉一点，下午那泡还能喝。", notify: true });

  await thread({
    id: "thr_intern",
    postId: "pst_intern",
    authorId: "usr_zhao",
    boardId: "brd_general",
    hours: 90,
    title: "实习生第一次写周报，我该改到什么程度？",
    content: "他写得很满，但分不清「做了」和「做成了」。我是直接改一版给他看，还是只标出问题让他自己改？",
  });
  await reply({ id: "pst_intern_lin", threadId: "thr_intern", authorId: "usr_lin", parentId: "pst_intern", hours: 86, content: "先标问题。你改完的那一版他会谢谢你，然后下周继续交同一份。" });
  await reply({ id: "pst_intern_su", threadId: "thr_intern", authorId: "usr_su", parentId: "pst_intern_lin", hours: 84, content: "编辑部也是这样。红笔指出「这句话没有动作」，比替他写完有用。" });

  await thread({
    id: "thr_lychee",
    postId: "pst_lychee",
    authorId: "usr_qiao",
    boardId: "brd_culture",
    hours: 60,
    title: "《长安的荔枝》读完了，想听不同意见",
    content: "我喜欢它把一件看起来很小的差事写成一个人怎么把日子过完。有人觉得结局太顺吗？",
  });
  await reply({ id: "pst_lychee_su", threadId: "thr_lychee", authorId: "usr_su", parentId: "pst_lychee", hours: 56, content: "顺的是任务，不顺的是人。我没觉得结局轻。" });
  await reply({ id: "pst_lychee_he", threadId: "thr_lychee", authorId: "usr_he", parentId: "pst_lychee_su", hours: 54, content: "我在意的是他写路程的方式，一站一站，像把地图摊开。" });

  const insertRows = async (sql: string, rows: unknown[][]) => {
    if (rows.length === 0) return;
    const width = rows[0].length;
    const values = rows.map(() => `(${Array.from({ length: width }, () => "?").join(", ")})`).join(", ");
    await tx.run(`${sql} VALUES ${values}`, rows.flat());
  };
  await insertRows(
    `INSERT INTO threads (
      id, board_id, author_id, title, is_pinned, is_locked, view_count, reply_count,
      created_at, updated_at, last_post_at, last_post_user_id
    )`,
    threadRows,
  );
  await insertRows(
    "INSERT INTO posts (id, thread_id, author_id, parent_id, content, is_op, created_at, updated_at)",
    postRows,
  );
  await tx.run(
    `UPDATE threads SET
      reply_count = (
        SELECT COUNT(*) FROM posts
        WHERE posts.thread_id = threads.id AND posts.deleted_at IS NULL AND posts.is_op = 0
      ),
      last_post_at = (
        SELECT posts.created_at FROM posts
        WHERE posts.thread_id = threads.id AND posts.deleted_at IS NULL
        ORDER BY posts.created_at DESC LIMIT 1
      ),
      last_post_user_id = (
        SELECT posts.author_id FROM posts
        WHERE posts.thread_id = threads.id AND posts.deleted_at IS NULL
        ORDER BY posts.created_at DESC LIMIT 1
      )`,
  );
  await tx.run("UPDATE threads SET updated_at = last_post_at");
  await insertRows(
    `INSERT INTO notifications (
      id, user_id, actor_id, type, title, body, href, read_at, created_at
    )`,
    noteRows,
  );

  await tx.run("UPDATE threads SET is_pinned = 1, is_locked = 1 WHERE id = 'thr_rules'");
  await tx.run("UPDATE threads SET is_pinned = 1 WHERE id = 'thr_shop'");
  await tx.run("UPDATE threads SET is_locked = 1 WHERE id = 'thr_git'");
  const views: Array<[string, number]> = [
    ["thr_rules", 428],
    ["thr_books", 196],
    ["thr_sqlite", 241],
    ["thr_wang", 133],
    ["thr_weather", 88],
    ["thr_type", 174],
    ["thr_shop", 152],
    ["thr_podcast", 207],
    ["thr_pork", 96],
    ["thr_git", 310],
    ["thr_tea", 64],
    ["thr_intern", 118],
    ["thr_lychee", 141],
  ];
  for (const [id, count] of views) {
    await tx.run("UPDATE threads SET view_count = ? WHERE id = ?", [count, id]);
  }

  const spamReport = await createReport({
    reporterId: "usr_he",
    targetType: "post",
    targetId: "pst_weather_spam",
    reason: "spam",
    detail: "和天气无关，是引流。",
    createdAt: ago(14.2),
  }, tx);
  await resolveReport({
    reportId: spamReport.reportId,
    actorId: "usr_lin",
    action: "hide",
    note: "广告引流，已隐藏。",
  }, tx);

  await createReport({
    reporterId: "usr_miao",
    targetType: "post",
    targetId: "pst_books_zhao",
    reason: "abuse",
    detail: "语气有点冲，我不确定算不算人身攻击，请版主看一下。",
    createdAt: ago(15.8),
  }, tx);

  await tx.run(
    `INSERT INTO thread_reads (user_id, thread_id, last_read_at)
     SELECT u.id, t.id,
       CASE
         WHEN t.last_post_user_id = u.id THEN t.last_post_at
         WHEN t.last_post_at > ? THEN 0
         ELSE t.last_post_at
       END
     FROM users u CROSS JOIN threads t
     WHERE t.deleted_at IS NULL
     ON CONFLICT (user_id, thread_id) DO UPDATE SET last_read_at = excluded.last_read_at`,
    [ago(36)],
  );
  await tx.run("UPDATE notifications SET read_at = created_at WHERE created_at < ?", [ago(36)]);
}
