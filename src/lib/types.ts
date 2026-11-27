export type Gender = "MALE" | "FEMALE";
export type RoomGenderType = "EMPTY" | "MALE" | "FEMALE";
export type RegistrationStatus = "PENDING" | "APPROVED" | "REJECTED" | "CHECKED_OUT";

export interface DynamicField {
  id: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox";
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface SystemConfig {
  id: number;
  is_portal_open: boolean;
  open_at: string | null;
  close_at: string | null;
  announcement: string;
  dynamic_fields: DynamicField[];
}

export interface RegistrationWave {
  id: string;
  name: string;
  is_active: boolean;
}

export interface Building {
  id: string;
  code: string;
  name: string;
  is_locked: boolean;
  sort_order: number;
}

export interface Amenity {
  id: string;
  name: string;
  icon: string;
}

export interface PublicRoom {
  id: string;
  building_id: string;
  floor: number;
  room_code: string;
  capacity: number;
  current_count: number;
  price: number;
  gender_type: RoomGenderType;
  fixed_gender: Gender | null;
  is_locked: boolean;
  note: string;
  amenity_ids: string[];
}

export interface PublicRoomsPayload {
  system_config: SystemConfig;
  active_wave: RegistrationWave | null;
  buildings: Building[];
  amenities: Amenity[];
  rooms: PublicRoom[];
  fetched_at: string;
}

export interface LookupRegistration {
  id: string;
  student_code: string;
  full_name: string;
  gender: Gender;
  dob: string;
  status: RegistrationStatus;
  reject_reason: string | null;
  extra_data: Record<string, unknown>;
  created_at: string;
  room_code: string;
  floor: number;
  price: number;
  building_code: string;
  building_name: string;
  wave_name: string;
}
