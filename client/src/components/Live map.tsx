import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { io, Socket } from 'socket.io-client';
import { useStore, MapObject } from '../store';
import Toolbar from './Toolbar';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// Цвета команд (должны совпадать с сервером)
const TEAM_COLORS: Record<string, string> = {
  red: '#FF0000',
  blue: '#0000FF',
  green: '#00FF00',
  yellow: '#FFFF00',
  black: '#000000',
};

// Иконка бойца (кружок цвета команды)
function createFighterIcon(color: string) {
  return new L.DivIcon({
    className: 'fighter-icon',
    html: `<div style="background: ${color}; border-radius: 50%; width: 22px; height: 22px; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// Иконки для объектов
const ENEMY_ICON = new L.DivIcon({
  className: 'enemy-icon',
  html: '<div style="font-size: 24px; text-align: center;">🔴</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});
const TARGET_ICON = new L.DivIcon({
  className: 'target-icon',
  html: '<div style="font-size: 28px; text-align: center;">🎯</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});
const FLAG_ICON = new L.DivIcon({
  className: 'flag-icon',
  html: '<div style="font-size: 28px; text-align: center;">🚩</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// Компонент для обработки кликов по карте с учётом выбранного инструмента
function MapClickHandler({ socket }: { socket: Socket }) {
  const selectedTool = useStore((s) => s.selectedTool);
  const addMapObject = useStore((s) => s.addMapObject);
  const arrowStart = useRef<L.LatLng | null>(null);

  useMapEvents({
    click(e) {
      if (!selectedTool) return;
      const { lat, lng } = e.latlng;

      if (selectedTool === 'enemy') {
        const obj: MapObject = {
          id: '', // сервер присвоит
          type: 'enemy',
          data: { lat, lng }
        };
        socket.emit('addObject', obj);
      } else if (selectedTool === 'target') {
        socket.emit('addObject', { type: 'target', data: { lat, lng } });
      } else if (selectedTool === 'flag') {
        socket.emit('addObject', { type: 'flag', data: { lat, lng } });
      } else if (selectedTool === 'arrow') {
        if (!arrowStart.current) {
          arrowStart.current = e.latlng;
          // показать начальную точку?
        } else {
          const start = arrowStart.current;
          const obj: MapObject = {
            id: '',
            type: 'arrow',
            data: { latlngs: [start, { lat, lng }] }
          };
          socket.emit('addObject', obj);
          arrowStart.current = null;
        }
      }
    }
  });
  return null;
}

// Компонент для отслеживания геолокации
function LocationTracker({ socket, fighterId }: { socket: Socket; fighterId: string }) {
  useMapEvents({}); // для активации событий карты
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        socket.emit('position', { lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [socket]);
  return null;
}

export default function LiveMap({ fighterId, team }: { fighterId: string; team: string }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const store = useStore();

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    newSocket.on('connect', () => {
      newSocket.emit('register', { id: fighterId, team });
    });

    newSocket.on('init', (data: any) => {
      const { fighters: serverFighters, mapObjects: serverObjects } = data;
      serverFighters?.forEach((f: any) => store.updateFighter(f));
      serverObjects?.forEach((obj: MapObject) => store.addMapObject(obj));
    });

    newSocket.on('positionUpdate', (fighter: any) => {
      store.updateFighter(fighter);
    });

    newSocket.on('fighterLeft', (id: string) => {
      store.removeFighter(id);
    });

    newSocket.on('objectAdded', (obj: MapObject) => {
      store.addMapObject(obj);
    });

    newSocket.on('objectRemoved', (id: string) => {
      store.removeMapObject(id);
    });

    newSocket.on('objectsCleared', () => {
      store.clearMapObjects();
    });

    setSocket(newSocket);
    return () => { newSocket.close(); };
  }, [fighterId, team]);

  // Переопределяем очистку объектов с отправкой на сервер
  const handleClearObjects = () => {
    if (socket) {
      socket.emit('clearObjects');
      store.clearMapObjects();
    }
  };

  // Обновляем метод store.clearMapObjects для отправки события
  useEffect(() => {
    const originalClear = store.clearMapObjects;
    store.clearMapObjects = () => {
      if (socket) socket.emit('clearObjects');
      originalClear();
    };
  }, [socket]);

  // Рендеринг объектов карты
  const renderMapObjects = () => {
    return store.mapObjects.map(obj => {
      if (obj.type === 'enemy') {
        return (
          <Marker key={obj.id} position={[obj.data.lat, obj.data.lng]} icon={ENEMY_ICON}>
            <Popup>Враг</Popup>
          </Marker>
        );
      } else if (obj.type === 'target') {
        return (
          <Marker key={obj.id} position={[obj.data.lat, obj.data.lng]} icon={TARGET_ICON}>
            <Popup>Цель</Popup>
          </Marker>
        );
      } else if (obj.type === 'flag') {
        return (
          <Marker key={obj.id} position={[obj.data.lat, obj.data.lng]} icon={FLAG_ICON}>
            <Popup>Флаг</Popup>
          </Marker>
        );
      } else if (obj.type === 'arrow') {
        const coords: [number, number][] = obj.data.latlngs.map((p: any) => [p.lat, p.lng]);
        // Добавим стрелку на конце через кастомную иконку
        const lastPoint = coords[coords.length - 1];
        const arrowAngle = calculateAngle(coords[coords.length - 2], lastPoint);
        return (
          <React.Fragment key={obj.id}>
            <Polyline positions={coords} color="red" weight={3} />
            <Marker
              position={lastPoint}
              icon={new L.DivIcon({
                className: 'arrow-head',
                html: `<div style="transform: rotate(${arrowAngle}deg); font-size: 20px;">➤</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              })}
            />
          </React.Fragment>
        );
      }
      return null;
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <MapContainer center={[55.751244, 37.618423]} zoom={10} style={{ height: '100vh', width: '100%' }}>
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Схема">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Спутник">
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        {socket && <MapClickHandler socket={socket} />}
        {socket && <LocationTracker socket={socket} fighterId={fighterId} />}
        {/* Отображение всех бойцов */}
        {Array.from(store.fighters.values()).map(f => (
          <Marker
            key={f.id}
            position={[f.lat, f.lng]}
            icon={createFighterIcon(TEAM_COLORS[f.team] || '#999')}
          >
            <Popup>
              <strong>{f.id}</strong><br />Команда: {f.team}
            </Popup>
          </Marker>
        ))}
        {/* Объекты карты */}
        {renderMapObjects()}
      </MapContainer>
      <Toolbar />
      {/* Отображение своего позывного */}
      <div style={{
        position: 'absolute', top: 10, left: 10, zIndex: 1000,
        background: 'white', padding: '4px 10px', borderRadius: 4,
        boxShadow: '0 1px 5px rgba(0,0,0,0.4)'
      }}>
        {fighterId} [{team}]
      </div>
    </div>
  );
}

// Вспомогательная функция для вычисления угла стрелки
function calculateAngle(start: [number, number], end: [number, number]): number {
  const dx = end[1] - start[1];
  const dy = end[0] - start[0];
  const angleRad = Math.atan2(dy, dx);
  return angleRad * (180 / Math.PI) + 90; // корректировка для символа
}
