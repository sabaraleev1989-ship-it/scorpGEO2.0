import { useStore } from '../store';

const tools = [
  { id: 'enemy', label: 'Враг', icon: '🔴' },
  { id: 'arrow', label: 'Атака', icon: '➡️' },
  { id: 'target', label: 'Цель', icon: '🎯' },
  { id: 'flag', label: 'Флаг', icon: '🚩' },
];

export default function Toolbar() {
  const selectedTool = useStore((s) => s.selectedTool);
  const setTool = useStore((s) => s.setTool);
  const clearObjects = useStore((s) => s.clearMapObjects);

  return (
    <div style={{
      position: 'absolute', top: 80, left: 10, zIndex: 1000,
      background: 'rgba(255,255,255,0.9)', borderRadius: 8, padding: 8,
      display: 'flex', flexDirection: 'column', gap: 5,
      boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
    }}>
      {tools.map(tool => (
        <button
          key={tool.id}
          title={tool.label}
          onClick={() => setTool(selectedTool === tool.id ? null : tool.id)}
          style={{
            fontSize: 22, padding: 5, cursor: 'pointer',
            border: selectedTool === tool.id ? '3px solid black' : '1px solid gray',
            borderRadius: 4, background: selectedTool === tool.id ? '#e6e6e6' : 'white'
          }}
        >
          {tool.icon}
        </button>
      ))}
      <button
        title="Отменить последний объект"
        onClick={() => {
          const objs = useStore.getState().mapObjects;
          if (objs.length > 0) {
            const last = objs[objs.length - 1];
            // вызовем событие удаления через сокет (получится циклично, поэтому вынесем)
            useStore.getState().removeMapObject(last.id);
          }
        }}
        style={{ fontSize: 22, padding: 5, cursor: 'pointer', border: '1px solid gray', borderRadius: 4 }}
      >
        ↩️
      </button>
      <button
        title="Очистить все объекты"
        onClick={clearObjects}
        style={{ fontSize: 22, padding: 5, cursor: 'pointer', border: '1px solid gray', borderRadius: 4 }}
      >
        🗑️
      </button>
    </div>
  );
}
