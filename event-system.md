# EVENT SYSTEM

## 1. CORE EVENTS
## 2. ACTIVITY EVENTS
## 3. POINT EVENTS
## 4. STREAK EVENTS
## 5. ACHIEVEMENT EVENTS
## 6. SOCIAL EVENTS
## 7. PURITY EVENTS
## 8. JOURNAL EVENTS

## USER_ACTIVITY_LOGGED

### Trigger
User logs activity (power, mind, craft)

### Payload
- user_id
- activity_id
- section
- date
- did_user_do
- hours

### Consumers
- Points Service
- Streak Service
- Achievement Service
- Notification Service
- Insight Service

## STREAK_UPDATED

### Trigger
After activity is processed

### Payload
- user_id
- section
- current_streak

### Consumers
- Achievement Service
- Notification Service

## POINTS_UPDATED

### Trigger
After points are calculated

### Payload
- user_id
- points_added
- section
- source

### Consumers
- Notification Service
- Analytics

## ACHIEVEMENT_UNLOCKED

### Trigger
When condition is satisfied

### Payload
- user_id
- achievement_id

### Consumers
- Notification Service
- WebSocket (real-time UI)

## RELAPSE_RECORDED

### Trigger
User records relapse

### Payload
- user_id
- occurred_at

### Consumers
- Points Service
- Streak Service
- Notification Service
- Insight Service

## JOURNAL_CREATED

### Trigger
User writes journal

### Payload
- user_id
- date

### Consumers
- Points Service
- Achievement Service

## POST_CREATED

### Trigger
User creates post

### Payload
- user_id
- post_id

### Consumers
- Points Service
- Achievement Service

## POST_LIKED

### Trigger
User likes post

### Payload
- user_id
- post_id

### Consumers
- Achievement Service

# EVENT FLOW

USER_ACTIVITY_LOGGED
  → POINTS_UPDATED
  → STREAK_UPDATED
  → ACHIEVEMENT_UNLOCKED
  → NOTIFICATION_SENT
  → INSIGHT_GENERATED

  User → Activity → Event → Multiple Services