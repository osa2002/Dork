import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  
  const app = initializeApp(config);
  const db = getFirestore(app, config.firestoreDatabaseId);
  
  console.log("Fetching all ticket_counters from Firestore...");
  const countersRef = collection(db, "ticket_counters");
  const snap = await getDocs(countersRef);
  
  console.log(`Found ${snap.size} counters.`);
  snap.forEach((doc) => {
    console.log(`ID: ${doc.id} | Data:`, doc.data());
  });
}

main().catch(console.error);
