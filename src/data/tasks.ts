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
 * Sáu nhiệm vụ cốt lõi của Module 1 — tạo tài liệu phục vụ hoạt động dạy học.
 * Sáu nhãn này phải trùng từng chữ với 06 việc của hoạt động 2; báo cáo viên nối
 * hai hoạt động bằng chính sáu nhãn ấy nên mọi sửa đổi cần sửa đồng thời ở hai nơi.
 * Nhãn ngắn lấy theo quy ước đặt tên tệp ở Phụ lục 5 để người học nhận ra sản phẩm.
 */
export const CORE_TASKS: TaskDef[] = [
  { id: 'matran', label: 'Gợi ý khung ma trận đặc tả', short: 'MA TRẬN', iconIndex: 0, kind: 'CORE' },
  { id: 'khbd', label: 'Soạn bản nháp kế hoạch bài dạy', short: 'KHBD', iconIndex: 2, kind: 'CORE' },
  { id: 'slide', label: 'Gợi ý dàn ý kịch bản trình chiếu', short: 'TRÌNH CHIẾU', iconIndex: 1, kind: 'CORE' },
  { id: 'pht', label: 'Soạn bản nháp phiếu học tập', short: 'PHIẾU', iconIndex: 3, kind: 'CORE' },
  { id: 'btvn', label: 'Gợi ý bài tập theo yêu cầu', short: 'BÀI TẬP', iconIndex: 4, kind: 'CORE' },
  { id: 'infographic', label: 'Tạo bản nháp nội dung infographic', short: 'INFOGRAPHIC', iconIndex: 1, kind: 'CORE' },
];

/**
 * Sáu quả nhiễu: việc cần hiện diện, thấu cảm, phán đoán chuyên môn,
 * kiểm tra độ chính xác hoặc chịu trách nhiệm về quyết định cuối cùng.
 * Trí tuệ nhân tạo có thể cung cấp thông tin tham khảo nhưng không làm thay trách nhiệm của giáo viên.
 * Đủ 06 quả cam và 06 quả xanh thành 12 quả — đúng số nêu ở mục c của hoạt động 1.
 * iconIndex ghi rõ từng mục vì danh sách đã bớt hai việc; nếu để trống thì biểu tượng
 * tính theo vị trí trong ALL_TASKS và cả sáu quả sẽ đổi hình.
 */
export const NOISE_TASKS: TaskDef[] = [
  { id: 'n_quansat', label: 'Quan sát trực tiếp phản ứng của học sinh', iconIndex: 7, kind: 'NOISE' },
  { id: 'n_kiemtra', label: 'Kiểm tra độ chính xác của nội dung chuyên môn', iconIndex: 6, kind: 'NOISE' },
  { id: 'n_quyetdinh', label: 'Quyết định mục tiêu và phương án dạy học', iconIndex: 8, kind: 'NOISE' },
  { id: 'n_danhgia', label: 'Đánh giá học sinh cần hỗ trợ riêng', iconIndex: 11, kind: 'NOISE' },
  { id: 'n_phuhuynh', label: 'Trao đổi trực tiếp với phụ huynh', iconIndex: 13, kind: 'NOISE' },
  { id: 'n_pheduyet', label: 'Phê duyệt và chịu trách nhiệm về sản phẩm cuối', iconIndex: 12, kind: 'NOISE' },
];

export const ALL_TASKS: TaskDef[] = [...CORE_TASKS, ...NOISE_TASKS];
