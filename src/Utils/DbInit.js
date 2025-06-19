
import { openDB } from 'idb';

const DB_NAME = 'piping'; //huldrascreencoverage1  Test12345678
const DB_VERSION = 1; // Incrementing version to handle new store
const TARGET_DEPTH = 4;

export const initDB = async () => {
    try {
        const db = await openDB(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion, newVersion) {
                if (!db.objectStoreNames.contains('octree')) {
                    db.createObjectStore('octree');
                }
                if (!db.objectStoreNames.contains('originalMeshes')) {
                    db.createObjectStore('originalMeshes');
                }              
                if (!db.objectStoreNames.contains('mergedMeshes')) {
                    db.createObjectStore('mergedMeshes');
                }
                if (!db.objectStoreNames.contains('placementSummary')) {
                    db.createObjectStore('placementSummary');
                }
                
            },
        });
        return db;
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
};
