import * as fs from "fs";
import * as path from "path";

export type FaceRole = "admin" | "resident" | "guest" | "courier" | "technician";

export interface FaceProfile {
  id: string;
  name: string;
  role: FaceRole;
  addedDate: string; // "DD.MM.YYYY"
  imageFile?: string; // filename in faces/ directory
}

const DATA_DIR = path.join(process.cwd(), "data");
const FACES_FILE = path.join(DATA_DIR, "faces.json");

class FaceDB {
  private profiles: FaceProfile[] = [];
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(FACES_FILE)) {
      try {
        const data = fs.readFileSync(FACES_FILE, "utf-8");
        this.profiles = JSON.parse(data);
      } catch (error) {
        console.error("[FaceDB] Error loading profiles:", error);
        this.profiles = [];
      }
    }

    this.initialized = true;
  }

  private save() {
    try {
      fs.writeFileSync(FACES_FILE, JSON.stringify(this.profiles, null, 2));
    } catch (error) {
      console.error("[FaceDB] Error saving profiles:", error);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getProfiles(): FaceProfile[] {
    return [...this.profiles];
  }

  getProfile(id: string): FaceProfile | undefined {
    return this.profiles.find((p) => p.id === id);
  }

  addProfile(profile: Omit<FaceProfile, "id">): FaceProfile {
    const newProfile: FaceProfile = {
      ...profile,
      id: this.generateId(),
    };
    this.profiles.push(newProfile);
    this.save();
    console.log(`[FaceDB] Profile added: ${profile.name} (${profile.role})`);
    return newProfile;
  }

  deleteProfile(id: string): boolean {
    const index = this.profiles.findIndex((p) => p.id === id);
    if (index === -1) return false;
    this.profiles.splice(index, 1);
    this.save();
    console.log(`[FaceDB] Profile deleted: ${id}`);
    return true;
  }
}

export const faceDB = new FaceDB();
