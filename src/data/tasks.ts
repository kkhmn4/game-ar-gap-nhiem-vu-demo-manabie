export type TaskKind = 'CORE' | 'NOISE';

export interface TaskDef {
  id: string;
  label: string;
  /** Nhãn ngắn cho ô tiến độ trên bảng điểm — đọc được từ cuối phòng. */
  short?: string;
  kind: TaskKind;
}

/**
 * Sáu nhiệm vụ cốt lõi — đúng danh sách trong kế hoạch demo Manabie.
 * Sáu quả này gắp vào giỏ chính là sáu nhiệm vụ chia cho sáu nhóm ở hoạt động 2.
 */
export const CORE_TASKS: TaskDef[] = [
  { id: 'khbd', label: 'Tạo kế hoạch bài dạy', short: 'KHBD', kind: 'CORE' },
  { id: 'slide', label: 'Tạo slide bài giảng', short: 'SLIDE', kind: 'CORE' },
  { id: 'pht', label: 'Thiết kế phiếu học tập', short: 'PHIẾU', kind: 'CORE' },
  { id: 'btvn', label: 'Tạo bài tập về nhà', short: 'BTVN', kind: 'CORE' },
  { id: 'dekt', label: 'Thiết kế đề kiểm tra', short: 'ĐỀ KT', kind: 'CORE' },
  { id: 'phhs', label: 'Giao tiếp với phụ huynh', short: 'PHỤ HUYNH', kind: 'CORE' },
];

/**
 * Quả nhiễu: buồn cười nhưng KHÔNG xúc phạm nghề.
 * Điểm chung của nhóm này là việc cần mặt người hoặc việc vặt — AI không làm thay được.
 */
export const NOISE_TASKS: TaskDef[] = [
  { id: 'n_cafe', label: 'Pha cà phê cho tổ trưởng', kind: 'NOISE' },
  { id: 'n_mxh', label: 'Lướt mạng xã hội', kind: 'NOISE' },
  { id: 'n_banghe', label: 'Xếp lại bàn ghế', kind: 'NOISE' },
  { id: 'n_doxe', label: 'Tìm chỗ đỗ xe', kind: 'NOISE' },
  { id: 'n_antrua', label: 'Đi ăn trưa căng tin', kind: 'NOISE' },
  { id: 'n_sacpin', label: 'Sạc pin điện thoại', kind: 'NOISE' },
  { id: 'n_tuoicay', label: 'Tưới cây văn phòng', kind: 'NOISE' },
  { id: 'n_avatar', label: 'Chọn ảnh đại diện Zalo', kind: 'NOISE' },
];

export const ALL_TASKS: TaskDef[] = [...CORE_TASKS, ...NOISE_TASKS];

/** Câu chốt sau khi chơi — dùng để dẫn sang hoạt động NotebookLM. */
export const DEBRIEF_LINE =
  'Sáu quả trong giỏ đều là việc tạo ra một sản phẩm giấy tờ — đó là loại việc AI làm được. ' +
  'Những quả rơi ra ngoài đều là việc cần mặt người. AI không làm thay được.';
