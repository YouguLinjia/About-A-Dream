// ===== 【TA的心情】字卡库（AI-A 业务域） =====
// 定位：梦角在正常聊天过程中，有概率主动告诉你自己现在的心情/状态/今天的一点感受。
// 发送方式与普通聊天字卡一致——不是"报告情绪"，不是"主动索取"，以分享为主。
// 数据由用户设计文档原文落地（15 类 233 张）。
// 权重（用户文档「二十三」核心比例）：
//   普通近况/平静 40%（平静15 + 今日近况20 + 不太想说15）
//   开心/轻松/满足 20%（开心15 + 轻松15 + 满足15）
//   疲惫/困/烦躁/低落 20%（疲惫18 + 困倦15 + 烦躁15 + 低落15）
//   想你/想陪你 15%（想你18 + 想陪你15）
//   突然感觉/小期待/情绪变化 5%（突然的感觉20 + 小期待15 + 情绪变化15）
// 分组名即字卡库页 chips 展示名；weights 中未列出的分组取默认 weight 1（展示用）。
// 单卡开关键：tm-off-<分组>:<内容>（'1' 关闭）；总开关键：tm-enabled。
window.TA_MOOD_DATA = {
  groups: [
    { group: '平静', weight: 15 },
    { group: '开心', weight: 15 },
    { group: '轻松', weight: 15 },
    { group: '满足', weight: 15 },
    { group: '疲惫', weight: 18 },
    { group: '困倦', weight: 15 },
    { group: '烦躁', weight: 15 },
    { group: '低落', weight: 15 },
    { group: '想你', weight: 18 },
    { group: '想陪你', weight: 15 },
    { group: '小期待', weight: 15 },
    { group: '突然的感觉', weight: 20 },
    { group: '今日近况', weight: 20 },
    { group: '不太想说', weight: 15 },
    { group: '情绪变化', weight: 15 }
  ],
  cards: [
    // ---- 平静（15）----
    { group: '平静', content: '今天没什么特别的事' },
    { group: '平静', content: '普通的一天，但普通就是最好的' },
    { group: '平静', content: '没有突发事件' },
    { group: '平静', content: '现在没什么烦恼' },
    { group: '平静', content: '今天状态还算不错' },
    // ---- 开心（15）----
    { group: '开心', content: '今天过得挺开心的' },
    { group: '开心', content: '今天状态挺不错的' },
    { group: '开心', content: '昨晚休息得很好' },
    { group: '开心', content: '今天有种莫名的好心情' },
    { group: '开心', content: '现在心情很好' },
    // ---- 轻松（15）----
    { group: '轻松', content: '今天挺轻松的' },
    { group: '轻松', content: '今天没那么忙' },
    { group: '轻松', content: '今天难得能放松一下' },
    { group: '轻松', content: '今天意外地很悠闲' },
    { group: '轻松', content: '就这样呆一会' },
    // ---- 满足（15）----
    { group: '满足', content: '今天的任务全部完成了' },
    { group: '满足', content: '现在感觉很好' },
    { group: '满足', content: '今天很充实' },
    { group: '满足', content: '刚刚突然觉得今天也很不错' },
    { group: '满足', content: '今天很开心' },
    // ---- 疲惫（18）----
    { group: '疲惫', content: '今天有点累' },
    { group: '疲惫', content: '今天的事情有点多' },
    { group: '疲惫', content: '今天想早点休息' },
    { group: '疲惫', content: '想休息一会' },
    { group: '疲惫', content: '现在不太想动' },
    // ---- 困倦（15）----
    { group: '困倦', content: '已经想睡觉了' },
    { group: '困倦', content: '现在脑子有点慢' },
    { group: '困倦', content: '今天好像特别适合睡觉' },
    { group: '困倦', content: '现在很想躺一会' },
    { group: '困倦', content: '一起睡一会吗' },
    // ---- 烦躁（15）----
    { group: '烦躁', content: '今天没什么耐心' },
    { group: '烦躁', content: '有些事情让我挺烦的' },
    { group: '烦躁', content: '事情出了点变故' },
    { group: '烦躁', content: '今天的麻烦有点多' },
    { group: '烦躁', content: '思绪有点乱' },
    // ---- 低落（15）----
    { group: '低落', content: '有点难过' },
    { group: '低落', content: '想安静呆一会' },
    { group: '低落', content: '没有什么想说的' },
    { group: '低落', content: '今天好像提不起劲' },
    { group: '低落', content: '有点郁闷' },
    // ---- 想你（18）----
    { group: '想你', content: '今天比平时更想你' },
    { group: '想你', content: '突然很想见你' },
    { group: '想你', content: '突然很想听你的声音' },
    { group: '想你', content: '想和你待在一起' },
    { group: '想你', content: '想抱抱你' },
    // ---- 想陪你（15）----
    { group: '想陪你', content: '想和你一起度过悠闲的一天' },
    { group: '想陪你', content: '陪我呆一会吧' },
    { group: '想陪你', content: '想把时间留给你' },
    { group: '想陪你', content: '想靠着你' },
    { group: '想陪你', content: '想做点什么？' },
    // ---- 小期待（15）----
    { group: '小期待', content: '今天好像会有好事发生' },
    { group: '小期待', content: '想到就有点开心' },
    { group: '小期待', content: '会发生什么呢？' },
    { group: '小期待', content: '对今天有点小小的期待' },
    { group: '小期待', content: '好像会是不错的一天' },
    // ---- 突然的感觉（20）----
    { group: '突然的感觉', content: '突然觉得有你挺好的' },
    { group: '突然的感觉', content: '突然有点想抱你' },
    { group: '突然的感觉', content: '突然有点想哭' },
    { group: '突然的感觉', content: '突然觉得有点安静' },
    { group: '突然的感觉', content: '突然觉得时间过得好快' },
    // ---- 今日近况（20）----
    { group: '今日近况', content: '今天比昨天轻松一点' },
    { group: '今日近况', content: '今天发现了一些之前没注意到的细节' },
    { group: '今日近况', content: '今天的状况比想象中好' },
    { group: '今日近况', content: '发生了有趣的事' },
    { group: '今日近况', content: '今天解决了之前遗留的问题' },
    // ---- 不太想说（15）----
    { group: '不太想说', content: '想自己安静一下' },
    { group: '不太想说', content: '有点事情，不想说' },
    { group: '不太想说', content: '暂时不想想那些事情' },
    { group: '不太想说', content: '不太想解释' },
    { group: '不太想说', content: '让我思考一下' },
    // ---- 情绪变化（15）----
    { group: '情绪变化', content: '不知道什么时候开始心情变好了' },
    { group: '情绪变化', content: '想明白之后轻松了很多' },
    { group: '情绪变化', content: '刚刚有点累，现在好多了' },
    { group: '情绪变化', content: '刚才还很困，突然清醒了' },
    { group: '情绪变化', content: '刚刚有点烦心事，现在已经没事了' }
  ]
};
