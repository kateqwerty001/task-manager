swagger: "2.0"
info:
  title: Task Manager API
  description: Task CRUD API for the Task Manager course project
  version: "1.0.0"
schemes:
  - https
produces:
  - application/json
consumes:
  - application/json

x-google-management:
  metrics:
    - name: task-manager-requests
      displayName: Task Manager requests
      valueType: INT64
      metricKind: DELTA
  quota:
    limits:
      - name: per-user-per-minute
        metric: task-manager-requests
        unit: "1/min/{project}"
        values:
          STANDARD: 60

paths:
  /tasks:
    options:
      summary: CORS preflight for /tasks
      operationId: corsTasks
      x-google-backend:
        address: ${create_task_uri}
        path_translation: CONSTANT_ADDRESS
      responses:
        "204":
          description: CORS preflight
    get:
      summary: List tasks for the authenticated user
      operationId: listTasks
      x-google-quota:
        metricCosts:
          task-manager-requests: 1
      x-google-backend:
        address: ${list_tasks_uri}
        path_translation: CONSTANT_ADDRESS
      responses:
        "200":
          description: List of tasks
    post:
      summary: Create a task
      operationId: createTask
      x-google-quota:
        metricCosts:
          task-manager-requests: 1
      x-google-backend:
        address: ${create_task_uri}
        path_translation: CONSTANT_ADDRESS
      responses:
        "201":
          description: Task created

  /tasks/{taskId}:
    options:
      summary: CORS preflight for /tasks/{taskId}
      operationId: corsTaskById
      parameters:
        - name: taskId
          in: path
          required: true
          type: string
      x-google-backend:
        address: ${update_task_uri}
        path_translation: APPEND_PATH_TO_ADDRESS
      responses:
        "204":
          description: CORS preflight
    get:
      summary: Get one task
      operationId: getTask
      parameters:
        - name: taskId
          in: path
          required: true
          type: string
      x-google-quota:
        metricCosts:
          task-manager-requests: 1
      x-google-backend:
        address: ${get_task_uri}
        path_translation: APPEND_PATH_TO_ADDRESS
      responses:
        "200":
          description: Task
    patch:
      summary: Update a task
      operationId: updateTask
      parameters:
        - name: taskId
          in: path
          required: true
          type: string
      x-google-quota:
        metricCosts:
          task-manager-requests: 1
      x-google-backend:
        address: ${update_task_uri}
        path_translation: APPEND_PATH_TO_ADDRESS
      responses:
        "200":
          description: Updated task
    delete:
      summary: Delete a task
      operationId: deleteTask
      parameters:
        - name: taskId
          in: path
          required: true
          type: string
      x-google-quota:
        metricCosts:
          task-manager-requests: 1
      x-google-backend:
        address: ${delete_task_uri}
        path_translation: APPEND_PATH_TO_ADDRESS
      responses:
        "204":
          description: Deleted

  /voice/parse:
    options:
      summary: CORS preflight for /voice/parse
      operationId: corsVoiceParse
      x-google-backend:
        address: ${voice_parse_uri}
        path_translation: CONSTANT_ADDRESS
      responses:
        "204":
          description: CORS preflight
    post:
      summary: Parse voice transcript into task fields
      operationId: voiceParse
      x-google-quota:
        metricCosts:
          task-manager-requests: 1
      x-google-backend:
        address: ${voice_parse_uri}
        path_translation: CONSTANT_ADDRESS
      responses:
        "200":
          description: Parsed task fields

  /admin/analytics:
    options:
      summary: CORS preflight for /admin/analytics
      operationId: corsAdminAnalytics
      x-google-backend:
        address: ${admin_analytics_uri}
        path_translation: CONSTANT_ADDRESS
      responses:
        "204":
          description: CORS preflight
    get:
      summary: Admin analytics dashboard data
      operationId: adminAnalytics
      x-google-quota:
        metricCosts:
          task-manager-requests: 1
      x-google-backend:
        address: ${admin_analytics_uri}
        path_translation: CONSTANT_ADDRESS
      responses:
        "200":
          description: Analytics summary
