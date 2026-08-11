import { parseUserRecipeText } from '../src/utils/userRecipeParser';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

const separateLines = parseUserRecipeText(`南瓜蒸蛋
食材：南瓜，鸡蛋
步骤
1. 南瓜蒸熟压泥
2、加入蛋液搅匀
3）上锅蒸熟`);
assert(separateLines.steps.length === 3, '应识别“步骤”标题后的逐行步骤');
assert(separateLines.steps[0] === '南瓜蒸熟压泥', '应移除步骤序号');

const inline = parseUserRecipeText(`番茄肉末面
用料：番茄，肉末，面条
制作步骤：1. 番茄切碎 2. 肉末炒熟 3. 加入面条煮软
注意事项：放凉后再给宝宝吃`);
assert(inline.steps.length === 3, '应识别步骤标题同一行的多个编号步骤');
assert(inline.steps[2] === '加入面条煮软', '同一行的最后一步内容应完整');
assert(inline.safetyNotes === '放凉后再给宝宝吃', '标题后的内容不应被后续分区误分类');
assert(!inline.incomplete, '食材和步骤齐全的粘贴内容应标记为完整');

const xiaohongshu = parseUserRecipeText(`[种草R] 蔬菜豆腐羹
食材：胡萝卜，香菇，豆腐，鸡蛋
[种草R] 保姆级步骤：
[一R] 处理食材：
胡萝卜、香菇切小丁，豆腐切小块。
[二R] 翻炒煮汤：
锅中放油翻炒，加水煮开。`);
assert(xiaohongshu.name === '蔬菜豆腐羹', '应移除社交平台装饰标记后识别名称');
assert(xiaohongshu.steps.length === 4, '应识别“保姆级步骤”和 [一R]、[二R] 步骤标记');
assert(xiaohongshu.steps[0] === '处理食材：', '应清理 [一R] 步骤标记');
assert(xiaohongshu.steps[2] === '翻炒煮汤：', '应清理 [二R] 步骤标记');
assert(!xiaohongshu.incomplete, '社交平台格式的食谱应识别为完整');

const decoratedDetailedSteps = parseUserRecipeText(`鲜虾蔬菜饼
食材：鲜虾，胡萝卜，面粉
✨宝宝辅食｜保姆级步骤：
鲜虾去壳去虾线，剁成虾泥。
胡萝卜焯水后切碎。
全部食材混合，煎至两面金黄。`);
assert(decoratedDetailedSteps.steps.length === 3, '“保姆级步骤”下方的普通文本行都应识别为步骤');
assert(decoratedDetailedSteps.steps[0] === '鲜虾去壳去虾线，剁成虾泥。', '步骤标题前有装饰文案时仍应开启步骤区块');
assert(decoratedDetailedSteps.steps[2] === '全部食材混合，煎至两面金黄。', '应持续识别标题下方的全部步骤');

console.log('user recipe parser tests passed');
