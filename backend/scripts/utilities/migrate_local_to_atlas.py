#!/usr/bin/env python
"""
Migrate all collections and documents from local MongoDB to MongoDB Atlas.
"""
import sys
import os
import urllib.parse
from pymongo import MongoClient

# Setup paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fedhealth.settings')

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import django
django.setup()

from django.conf import settings

LOCAL_URI = 'mongodb://localhost:27017/'
ATLAS_URI = settings.MONGO_DB_URL

def migrate():
    print(f"Connecting to Local MongoDB at {LOCAL_URI}...")
    local_client = MongoClient(LOCAL_URI)
    local_db = local_client['fedhealth']

    print(f"Connecting to Atlas MongoDB...")
    atlas_client = MongoClient(ATLAS_URI)
    atlas_db = atlas_client['fedhealth']

    collections = local_db.list_collection_names()
    print(f"Found {len(collections)} collections to migrate: {collections}\n")

    total_migrated = 0
    for col_name in collections:
        local_col = local_db[col_name]
        atlas_col = atlas_db[col_name]

        count = local_col.count_documents({})
        if count == 0:
            print(f"Skipping {col_name} (0 documents)")
            continue

        print(f"Migrating '{col_name}' ({count} documents)...")

        # Copy documents in chunks of 1000
        batch_size = 1000
        cursor = local_col.find({})
        batch = []
        col_migrated = 0

        # Optional: clear existing documents in atlas collection to prevent duplicate key errors
        atlas_col.delete_many({})

        for doc in cursor:
            batch.append(doc)
            if len(batch) >= batch_size:
                atlas_col.insert_many(batch)
                col_migrated += len(batch)
                print(f"  - Copied {col_migrated}/{count}...")
                batch = []

        if batch:
            atlas_col.insert_many(batch)
            col_migrated += len(batch)

        # Copy indexes (excluding _id_)
        try:
            indexes = list(local_col.list_indexes())
            for idx in indexes:
                if idx.get('name') == '_id_':
                    continue
                keys = list(idx['key'].items())
                kwargs = {}
                if 'unique' in idx:
                    kwargs['unique'] = idx['unique']
                if 'name' in idx:
                    kwargs['name'] = idx['name']
                atlas_col.create_index(keys, **kwargs)
        except Exception as idx_err:
            print(f"  Note on indexes for {col_name}: {idx_err}")

        atlas_count = atlas_col.count_documents({})
        print(f"  [OK] '{col_name}' done: {atlas_count} documents in Atlas.\n")
        total_migrated += col_migrated

    print(f"[SUCCESS] Migration complete! Successfully transferred {total_migrated} documents to MongoDB Atlas.")

if __name__ == '__main__':
    migrate()
