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

console.log('user recipe parser tests passed');
