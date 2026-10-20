import type { Department, DeskState, Developer } from "@/lib/types";

function person(
  id: string,
  name: string,
  role: string,
  department: Department,
  email: string,
): Developer {
  return { id, name, role, department, email };
}

/** IT staff list. Ids are stable and are not the email addresses. */
const ahmedSalam = person("ahmed-salam", "Ahmed Salam", "CTO", "IT", "");

const developers: Developer[] = [
  person("sham", "Sham Rahseed", "Information Security Officer", "Cloud & Security", "sham.rasheed@pension.gov.mv"),
  person("thoaha", "Thoaha Hassan", "Security Engineer", "Cloud & Security", "thoaha.hassan@pension.gov.mv"),
  person("liyaaz", "Liyaaz Yoosuf", "Graduate Trainee (GCP)", "Cloud & Security", "liyaaz.yoosuf@pension.gov.mv"),
  person("ali-zahir", "Ali Zahir", "Manager, Cloud and Security", "Cloud & Security", "ali.zahir@pension.gov.mv"),
  person("ulya", "Aishath Ulya Azim", "Data Engineer", "Data Services", "ulya.azim@pension.gov.mv"),
  person("areef", "Ahmed Areef", "DBA", "Data Services", "ahmed.areef@pension.gov.mv"),
  person("shahuza", "Shahuza Abdul Kareem", "Machine Learning Engineer", "Data Services", "shahuza.abdulkareem@pension.gov.mv"),
  person("dhunya", "Dhunya Abdul Hadhy", "Manager, Data Services", "Data Services", "dhunya.abdul@pension.gov.mv"),
  person("basil", "Hassan Basil Shafeeq", "Data Engineer", "Data Services", "basil.shafeeq@pension.gov.mv"),
  person("naif", "Hassan Naif Mohamed", "Lead Software Engineer", "Software Engineering", "naif.mohamed@pension.gov.mv"),
  person("nazeem", "Ahmed Nazeem", "Lead UI/UX Engineer", "Software Engineering", "ahmed.nazeem@pension.gov.mv"),
  person("nashath", "Mohamed Nashath", "Lead Software Engineer", "Software Engineering", "nashath.ahmed@pension.gov.mv"),
  person("maadh", "Maadh Ali Zameer", "Senior Software Engineer", "Software Engineering", "maadh.zameer@pension.gov.mv"),
  person("suhail", "Aboobakuru Suhail", "Software Engineer", "Software Engineering", "aboobakuru.suhail@pension.gov.mv"),
  person("shifan", "Mohamed Shifan", "Manager, Software Engineering", "Software Engineering", "mohamed.shifan@pension.gov.mv"),
  person("niyaaz", "Mohamed Niyaaz", "Lead Software Engineer", "Software Engineering", "mohamed.niyaaz@pension.gov.mv"),
  person("midhath", "Mohamed Midhath Ahmed", "Software Engineer", "Software Engineering", "mohamed.midhath@pension.gov.mv"),
  person("adam", "Adam Waheed", "Lead Software Engineer", "Software Engineering", "adam.waheed@pension.gov.mv"),
  person("mahmood", "Mahmood Waheed", "IT Director", "IT", "mahmood.waheed@pension.gov.mv"),
  ahmedSalam,
];

/** Desks saved before Ahmed Salam was on the roster still load, and gain him. */
export function ensureSeededRoster(current: Developer[]): Developer[] {
  const present = current.some(
    (person) => person.id === ahmedSalam.id || person.name.trim() === ahmedSalam.name,
  );
  if (present) return current;
  return [...current, { ...ahmedSalam }];
}

/**
 * Used only when the server has never stored a desk.
 * The roster is real. Projects and tasks start empty so a first visit is a blank desk.
 */
export function seedData(): DeskState {
  return {
    developers: developers.map((item) => ({ ...item })),
    projects: [],
    tasks: [],
    comments: [],
  };
}
