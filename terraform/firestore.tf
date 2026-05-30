resource "google_firestore_database" "database" {
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.apis]
}

# Index 1 — covers: user_id+status+priority AND user_id+status
resource "google_firestore_index" "tasks_user_status_priority" {
  collection = "tasks"
  query_scope = "COLLECTION"

  fields { 
    field_path = "user_id"
    order = "ASCENDING" 
  }
  fields { 
    field_path = "status"
    order = "ASCENDING" 
  }
  fields { 
    field_path = "priority"  
    order = "ASCENDING" 
  }
}

# Index 2 — covers: user_id+priority only
resource "google_firestore_index" "tasks_user_priority" {
  collection = "tasks"
  query_scope = "COLLECTION"

  fields { 
    field_path = "user_id"   
    order = "ASCENDING" 
  }
  fields { 
    field_path = "priority"
    order = "ASCENDING"
  }
}