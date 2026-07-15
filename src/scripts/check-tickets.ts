import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  
  const app = initializeApp(config);
  const db = getFirestore(app, config.firestoreDatabaseId);
  
  console.log("Fetching all tickets from Firestore...");
  const ticketsRef = collection(db, "tickets");
  const q = query(ticketsRef, orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  
  console.log(`Found ${snap.size} tickets in total.`);
  snap.forEach((doc) => {
    const data = doc.data();
    console.log(`ID: ${doc.id} | Shop: ${data.shopId} | Service: ${data.serviceName} | Name: ${data.customerName} | Num: ${data.ticketNumber} | Status: ${data.status} | CreatedAt: ${data.createdAt}`);
  });
}

main().catch(console.error);
