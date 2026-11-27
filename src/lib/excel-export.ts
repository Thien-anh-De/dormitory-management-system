import * as XLSX from "xlsx";
import type { DynamicField } from "./types";

export interface ExportRegistrationRow {
  id: string;
  student_code: string;
  full_name: string;
  gender: "MALE" | "FEMALE";
  dob: string;
  status: string;
  extra_data: Record<string, unknown>;
  created_at: string;
  rooms: {
    room_code: string;
    floor: number;
    buildings: {
      code: string;
      name: string;
    };
  };
  registration_waves: {
    name: string;
  };
}

function formatDateVN(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function exportStudentsByRoom(
  rows: ExportRegistrationRow[],
  dynamicFields: DynamicField[]
) {
  const sorted = [...rows].sort((a, b) => {
    const bCmp = a.rooms.buildings.code.localeCompare(b.rooms.buildings.code);
    if (bCmp !== 0) return bCmp;
    return a.rooms.room_code.localeCompare(b.rooms.room_code);
  });

  const data = sorted.map((r, idx) => {
    const base: Record<string, unknown> = {
      STT: idx + 1,
      "Tòa nhà": `${r.rooms.buildings.name} (${r.rooms.buildings.code})`,
      "Phòng": r.rooms.room_code,
      "Tầng": r.rooms.floor,
      "MSSV": r.student_code,
      "Họ và tên": r.full_name,
      "Giới tính": r.gender === "MALE" ? "Nam" : "Nữ",
      "Ngày sinh": formatDateVN(r.dob),
      "Trạng thái": r.status,
      "Đợt": r.registration_waves.name,
    };
    for (const f of dynamicFields) {
      base[f.label] = r.extra_data?.[f.id] ?? "";
    }
    return base;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Danh_sach_theo_phong");
  XLSX.writeFile(wb, `KTX_Danh_sach_theo_phong_${Date.now()}.xlsx`);
}

export function exportPoliceTemporaryResidence(
  rows: ExportRegistrationRow[],
  dynamicFields: DynamicField[]
) {
  const activeRows = rows.filter(
    (r) => r.status === "APPROVED" || r.status === "PENDING"
  );

  const data = activeRows.map((r, idx) => {
    const base: Record<string, unknown> = {
      STT: idx + 1,
      MSSV: r.student_code,
      "Họ và tên": r.full_name,
      "Giới tính": r.gender === "MALE" ? "Nam" : "Nữ",
      "Ngày sinh": formatDateVN(r.dob),
      Phòng: r.rooms.room_code,
      "Tòa nhà": r.rooms.buildings.name,
      "Ngày vào ở": formatDateVN(r.created_at),
    };
    for (const f of dynamicFields) {
      base[f.label] = r.extra_data?.[f.id] ?? "";
    }
    return base;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Khai_bao_tam_tru");
  XLSX.writeFile(wb, `KTX_Khai_bao_tam_tru_${Date.now()}.xlsx`);
}

export function exportFullBackupWorkbook(backup: {
  buildings: Record<string, unknown>[];
  rooms: Record<string, unknown>[];
  registrations: Record<string, unknown>[];
  config: Record<string, unknown> | null;
  audit_logs: Record<string, unknown>[];
}) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(backup.buildings),
    "Toa_nha"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(backup.rooms),
    "Danh_sach_phong"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      backup.registrations.map((r) => ({
        ...r,
        extra_data: JSON.stringify(r.extra_data ?? {}),
      }))
    ),
    "Danh_sach_dang_ky"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      backup.config
        ? [
            {
              ...backup.config,
              dynamic_fields: JSON.stringify(backup.config.dynamic_fields ?? []),
            },
          ]
        : []
    ),
    "Cau_hinh"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      backup.audit_logs.map((l) => ({
        ...l,
        details: JSON.stringify(l.details ?? {}),
      }))
    ),
    "Nhat_ky_hoat_dong"
  );

  XLSX.writeFile(wb, `KTX_Full_Backup_${Date.now()}.xlsx`);
}
