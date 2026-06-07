import mongoose from "mongoose";

let connected = false;

export async function connectDB(): Promise<boolean> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return false;
  if (connected) return true;

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000, connectTimeoutMS: 3000 });
    connected = true;
    console.log("  ✓ MongoDB conectado");
    return true;
  } catch (err) {
    console.warn("  ⚠ MongoDB no disponible, usando archivos JSON.", (err as Error).message);
    return false;
  }
}

export { mongoose };