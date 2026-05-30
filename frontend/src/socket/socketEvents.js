export function bindSocketEvents(socket, events) {
  if (!socket) return () => {};

  Object.entries(events).forEach(([eventName, handler]) => {
    socket.on(eventName, handler);
  });

  return () => {
    Object.entries(events).forEach(([eventName, handler]) => {
      socket.off(eventName, handler);
    });
  };
}
