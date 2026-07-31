export type TaskKind = 'CORE' | 'NOISE';

export interface TaskDef {
  id: string;
  label: string;
  /** Nhãn ngắn cho ô tiến độ trên bảng điểm — đọc được từ cuối phòng. */
  short?: string;
  kind: TaskKind;
}

/**
 * Sáu nhiệm vụ cốt lõi — các đầu ra số AI có thể hỗ trợ tạo bản nháp.
 * Giáo viên vẫn kiểm tra mục tiêu, độ chính xác, dữ liệu riêng tư và quyết định bản cuối.
 * Sáu quả này gắp vào giỏ chính là sáu nhiệm vụ chia cho sáu nhóm ở hoạt động 2.
 * Giữ nguyên thứ tự: mỗi vị trí khớp một ô trong mission-icon-atlas-v2.png.
 */
export const CORE_TASKS: TaskDef[] = [
  { id: 'khbd', label: 'Soạn dự thảo kế hoạch bài dạy', short: 'KHBD', kind: 'CORE' },
  { id: 'slide', label: 'Tạo bản nháp slide bài giảng', short: 'SLIDE', kind: 'CORE' },
  { id: 'pht', label: 'Soạn phiếu học tập', short: 'PHIẾU', kind: 'CORE' },
  { id: 'btvn', label: 'Gợi ý bài tập về nhà', short: 'BTVN', kind: 'CORE' },
  { id: 'dekt', label: 'Tạo bản nháp đề kiểm tra', short: 'ĐỀ KT', kind: 'CORE' },
  { id: 'phhs', label: 'Soạn thông báo cho phụ huynh', short: 'THÔNG BÁO', kind: 'CORE' },
];

/**
 * Quả nhiễu: việc cần hiện diện, thấu cảm, phán đoán nghề nghiệp hoặc thao tác vật lý.
 * AI có thể gợi ý, nhưng không được thay con người thực hiện hay chịu trách nhiệm.
 * Giữ nguyên thứ tự: các mục tiếp tục nối sau CORE_TASKS trong icon atlas.
 */
export const NOISE_TASKS: TaskDef[] = [
  { id: 'n_cafe', label: 'Pha cà phê cho tổ trưởng', kind: 'NOISE' },
  { id: 'n_chupanh', label: 'Trực tiếp chụp ảnh lớp học', kind: 'NOISE' },
  { id: 'n_banghe', label: 'Xếp lại bàn ghế', kind: 'NOISE' },
  { id: 'n_doxe', label: 'Đỗ xe tại trường', kind: 'NOISE' },
  { id: 'n_antrua', label: 'Ăn trưa tại căng tin', kind: 'NOISE' },
  { id: 'n_sacpin', label: 'Sạc pin điện thoại', kind: 'NOISE' },
  { id: 'n_tuoicay', label: 'Tưới cây văn phòng', kind: 'NOISE' },
  { id: 'n_phuhuynh', label: 'Trao đổi trực tiếp với phụ huynh', kind: 'NOISE' },
];

export const ALL_TASKS: TaskDef[] = [...CORE_TASKS, ...NOISE_TASKS];
