import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const pubClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

const ROOM = 'battlefield';

interface MapObject {
  id: string;
  type: 'enemy' | 'arrow' | 'target' | 'flag';
  data: any; // координаты в зависимости от типа
}

interface Fighter {
  id: string;
  team: string;
  lat: number;
  lng: number;
  ts: number;
}

const fighters = new Map<string, Fighter>();
const mapObjects: MapObject[] = []; // синхронизированные объекты карты

// Цвета команд (захардкодим, на клиенте тоже палитра)
const teamColors: Record<string, string> = {
  'red': '#FF0000',
  'blue': '#0000FF',
  'green': '#00FF00',
  'yellow': '#FFFF00',
  'black': '#000000',
};

io.on('connection', (socket) => {
  console.log(`Новое соединение: ${socket.id}`);
  let fighterId: string | null = null;
  let currentTeam: string | null = null;

  socket.on('register', (data: { id: string; team: string }) => {
    fighterId = data.id;
    currentTeam = data.team;
    socket.join(ROOM);

    // Отправляем новому клиенту всех бойцов и объекты карты
    const others = Array.from(fighters.values()).filter(f => f.id !== fighterId);
    socket.emit('init', {
      fighters: others,
      mapObjects,
      teams: Object.keys(teamColors)
    });

    // Если боец уже был (реконнект), обновим его позицию
    if (fighters.has(fighterId)) {
      const f = fighters.get(fighterId)!;
      f.ts = Date.now();
      socket.to(ROOM).emit('positionUpdate', f);
    }
  });

  socket.on('position', (pos: { lat: number; lng: number }) => {
    if (!fighterId || !currentTeam) return;
    const fighter: Fighter = {
      id: fighterId,
      team: currentTeam,
      lat: pos.lat,
      lng: pos.lng,
      ts: Date.now()
    };
    fighters.set(fighterId, fighter);
    socket.to(ROOM).emit('positionUpdate', fighter);
  });

  socket.on('addObject', (obj: MapObject) => {
    if (!fighterId) return;
    obj.id = uuidv4();
    mapObjects.push(obj);
    io.to(ROOM).emit('objectAdded', obj);
  });

  socket.on('removeObject', (objectId: string) => {
    const index = mapObjects.findIndex(o => o.id === objectId);
    if (index !== -1) {
      mapObjects.splice(index, 1);
      io.to(ROOM).emit('objectRemoved', objectId);
    }
  });

  socket.on('clearObjects', () => {
    while (mapObjects.length) mapObjects.pop();
    io.to(ROOM).emit('objectsCleared');
  });

  socket.on('disconnect', () => {
    if (fighterId) {
      fighters.delete(fighterId);
      io.to(ROOM).emit('fighterLeft', fighterId);
      console.log(`Боец ${fighterId} покинул комнату`);
    }
  });
});

httpServer.listen(3001, () => {
  console.log('Тактический сервер запущен на порту 3001');
});
