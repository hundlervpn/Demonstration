import cv2
import face_recognition
import os
import sys
from ultralytics import YOLO

# Добавляем путь, если вдруг Python капризничает
sys.path.append("/home/rodion/vs/cv_project/cv/lib/python3.12/site-packages")

# 1. Загрузка лиц из папки faces
known_encodings = []
known_names = []
print("Загружаем базу лиц...")

if not os.path.exists("faces"):
    os.makedirs("faces")

for file in os.listdir("faces"):
    if file.endswith(('.jpg', '.png', '.jpeg')):
        img = face_recognition.load_image_file(f"faces/{file}")
        encs = face_recognition.face_encodings(img)
        if encs:
            known_encodings.append(encs[0])
            known_names.append(os.path.splitext(file)[0].capitalize())

print(f"Готово! В базе: {known_names}")

# 2. Настройка YOLO и камеры
model = YOLO('yolov8n.pt')
cap = cv2.VideoCapture(0)

count = 0 # Счетчик кадров для оптимизации

while cap.isOpened():
    success, frame = cap.read()
    if not success: break

    # 1. РАСЧЕТЫ (раз в 3 кадра)
    if count % 3 == 0:
        new_faces = []
        results = model(frame, classes=[0], verbose=False)
        
        for res in results[0].boxes:
            x1, y1, x2, y2 = map(int, res.xyxy[0])
            
            # Ищем лицо только в верхней части тела (экономим время)
            face_roi = frame[y1:y1+(y2-y1)//2, x1:x2] 
            if face_roi.size > 0:
                rgb_roi = cv2.cvtColor(face_roi, cv2.COLOR_BGR2RGB)
                face_locs = face_recognition.face_locations(rgb_roi, model="hog") # hog быстрее для CPU
                
                name = "CHUZHOY"
                # Если лицо найдено, берем его координаты относительно всего кадра
                if face_locs:
                    top, right, bottom, left = face_locs[0]
                    # Корректируем координаты лица относительно всего кадра
                    l_top, l_right, l_bottom, l_left = y1+top-100, x1+right+100, y1+bottom+100, x1+left-100
                    
                    face_enc = face_recognition.face_encodings(rgb_roi, face_locs)[0]
                    matches = face_recognition.compare_faces(known_encodings, face_enc, tolerance=0.6)
                    if True in matches:
                        name = known_names[matches.index(True)]
                    
                    # Сохраняем маленькую рамку (вокруг лица)
                    new_faces.append(((l_top, l_right, l_bottom, l_left), name))
                else:
                    # Если лица не видно, рисуем маленькую метку над головой
                    new_faces.append(((y1, x1+20, y1+20, x1), "Searching..."))
        
        current_faces = new_faces

    # 2. ОТРИСОВКА (каждый кадр — убирает мерцание)
    for (top, right, bottom, left), name in current_faces:
        color = (0, 255, 0) if name != "CHUZHOY" and name != "Searching..." else (0, 0, 255)
        
        # Рисуем только маленькую рамку вокруг лица
        cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
        
        # Красивая подпись под рамкой
        cv2.rectangle(frame, (left, bottom), (right, bottom + 25), color, cv2.FILLED)
        cv2.putText(frame, name, (left + 5, bottom + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

    count += 1
    cv2.imshow("Guard System", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'): break

cap.release()
cv2.destroyAllWindows()