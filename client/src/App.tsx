import { useState } from 'react';
import LiveMap from './components/LiveMap';

const TEAMS = ['red', 'blue', 'green', 'yellow', 'black'];

function App() {
  const [joined, setJoined] = useState(false);
  const [fighterId, setFighterId] = useState('');
  const [team, setTeam] = useState(TEAMS[0]);

  const handleJoin = () => {
    if (fighterId.trim().length === 0) return;
    setJoined(true);
  };

  if (!joined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 100 }}>
        <h2>Вход в тактическую комнату</h2>
        <input
          value={fighterId}
          onChange={(e) => setFighterId(e.target.value)}
          placeholder="Позывной"
          style={{ padding: '8px', fontSize: 16, marginBottom: 10 }}
        />
        <label>Выберите команду:</label>
        <select value={team} onChange={(e) => setTeam(e.target.value)} style={{ padding: 8, fontSize: 16 }}>
          {TEAMS.map(t => (
            <option key={t} value={t}>{t.toUpperCase()}</option>
          ))}
        </select>
        <button onClick={handleJoin} style={{ marginTop: 15, padding: '10px 30px', fontSize: 18 }}>
          Войти в бой
        </button>
      </div>
    );
  }

  return <LiveMap fighterId={fighterId} team={team} />;
}

export default App;
