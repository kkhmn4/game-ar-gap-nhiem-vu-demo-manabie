export type TaskKind = 'CORE' | 'NOISE';

export interface TaskDef {
  id: string;
  label: string;
  /** Nhãn ngắn cho ô tiến độ trên bảng điểm — đọc được từ cuối phòng. */
  short?: string;
  /** Ô hình trong atlas 4 × 4; cho phép dùng biểu tượng phù hợp mà không lệ thuộc thứ tự nhiệm vụ. */
  iconIndex?: number;
  kind: TaskKind;
}

/**
 * Sáu nhiệm vụ cốt lõi — chép đúng Phụ lục 2 của kế hoạch bài dạy ngày 10/8.
 * Sáu nhãn này phải trùng từng chữ với 06 việc của hoạt động 2; báo cáo viên nối
 * hai hoạt động bằng chính sáu nhãn ấy nên mọi sửa đổi cần sửa đồng thời ở hai nơi.
 * Nhãn ngắn lấy theo quy ước đặt tên tệp ở Phụ lục 5 để người học nhận ra sản phẩm.
 */
export const CORE_TASKS: TaskDef[] = [
  { id: 'matran', label: 'Xây khung ma trận đặc tả cho môn', short: 'MA TRẬN', iconIndex: 0, kind: 'CORE' },
  { id: 'khbd', label: 'Soạn dự thảo kế hoạch bài dạy', short: 'KHBD', iconIndex: 2, kind: 'CORE' },
  { id: 'slide', label: 'Soạn kịch bản trình chiếu', short: 'TRÌNH CHIẾU', iconIndex: 1, kind: 'CORE' },
  { id: 'pht', label: 'Soạn phiếu học tập', short: 'PHIẾU', iconIndex: 3, kind: 'CORE' },
  { id: 'btvn', label: 'Gợi ý bài tập về nhà', short: 'BÀI TẬP', iconIndex: 4, kind: 'CORE' },
  { id: 'infographic', label: 'Tóm tắt bài học thành infographic', short: 'INFOGRAPHIC', iconIndex: 1, kind: 'CORE' },
];

/**
 * Sáu quả nhiễu: việc cần hiện diện, cần thấu cảm hoặc cần thao tác vật lí.
 * Trí tuệ nhân tạo có thể gợi ý nhưng không làm thay và không chịu trách nhiệm thay nhà giáo.
 * Đủ 06 quả cam và 06 quả xanh thành 12 quả — đúng số nêu ở mục c của hoạt động 1.
 * iconIndex ghi rõ từng mục vì danh sách đã bớt hai việc; nếu để trống thì biểu tượng
 * tính theo vị trí trong ALL_TASKS và cả sáu quả sẽ đổi hình.
 */
export const NOISE_TASKS: TaskDef[] = [
  { id: 'n_cafe', label: 'Pha cà phê tại phòng hội đồng', iconIndex: 6, kind: 'NOISE' },
  { id: 'n_chupanh', label: 'Trực tiếp chụp ảnh lớp học', iconIndex: 7, kind: 'NOISE' },
  { id: 'n_banghe', label: 'Xếp lại bàn ghế phòng học', iconIndex: 8, kind: 'NOISE' },
  { id: 'n_sacpin', label: 'Sạc pin thiết bị dạy học', iconIndex: 11, kind: 'NOISE' },
  { id: 'n_tuoicay', label: 'Tưới cây văn phòng', iconIndex: 12, kind: 'NOISE' },
  { id: 'n_phuhuynh', label: 'Trao đổi trực tiếp với phụ huynh', iconIndex: 13, kind: 'NOISE' },
];

export const ALL_TASKS: TaskDef[] = [...CORE_TASKS, ...NOISE_TASKS];
