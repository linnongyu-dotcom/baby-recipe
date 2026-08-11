import { Button } from './Button';
import { Modal } from './Modal';

interface RecipeSafetyNoticeProps {
  isOpen: boolean;
  onClose: () => void;
  onAcknowledge: () => void;
}

export function RecipeSafetyNotice({ isOpen, onClose, onAcknowledge }: RecipeSafetyNoticeProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="食谱使用提示">
      <div className="space-y-4 text-sm leading-7 text-gray-600">
        <p>
          食谱中的月龄阶段、食材搭配、食材用量、奶量及营养信息均为通用参考，不能替代儿科医生或注册营养师的诊断和个体化建议。
        </p>
        <p>
          请结合宝宝的生长发育、吞咽能力、疾病史及医生建议进行调整。首次尝试新食材时，请少量、单独添加，并留意是否出现过敏反应。
        </p>
        <p>
          如宝宝出现呼吸困难、面唇肿胀、持续呕吐或精神状态异常，请立即停止喂食并及时就医。
        </p>
        <Button onClick={onAcknowledge} className="mt-2 w-full">
          我知道了
        </Button>
      </div>
    </Modal>
  );
}
