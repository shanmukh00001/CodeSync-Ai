import { useParams } from "react-router-dom";

function Room() {
  const { roomId } = useParams();

  console.log(roomId);

  return <h1>Room: {roomId}</h1>;
}

export default Room;