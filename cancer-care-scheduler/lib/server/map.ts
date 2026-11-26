/* eslint-disable @typescript-eslint/no-explicit-any */
export const mRoom = (r: any) => ({ id: r.id, name: r.name, therapist: r.therapist, active: r.active, color: r.color });
export const mItem = (r: any) => ({ id: r.id, roomId: r.room_id, name: r.name, duration: r.duration, capacity: r.capacity, slots: r.slots });
export const mPatient = (r: any, withAmount = false) => ({ id: r.id, chartNo: r.chart_no, name: r.name, ward: r.ward, bed: r.bed,
  admitDate: r.admit_date, dischargeDate: r.discharge_date, plan: r.plan, notes: r.notes, source: r.source, status: r.status,
  ...(withAmount ? { contractAmount: r.contract_amount } : {}) });
export const mAppt = (r: any) => ({ id: r.id, patientId: r.patient_id, date: r.appt_date, time: r.appt_time,
  itemId: r.item_id, option: r.opt, status: r.status, memo: r.memo });
export const mUser = (r: any) => ({ id: r.id, username: r.username, name: r.name, role: r.role, roomIds: r.room_ids, allRooms: r.all_rooms === true,
  active: r.active, mustChange: r.must_change, lastLogin: r.last_login });
export const mSickroom = (r: any) => ({ roomNo: r.room_no, beds: r.beds, startDate: r.start_date, endDate: r.end_date, note: r.note });
