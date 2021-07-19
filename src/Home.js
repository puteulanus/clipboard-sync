import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'element-react';
import 'element-theme-default';

import axios from "axios";
import { v4 as uuidv4 } from 'uuid';

import { apiUrl, apiProtocol } from "./const";

function Home() {

  const [ roomList, setRoomList ] = useState([]);

  const fetchRoomList = async () => {
    const res = await axios.get(`http${apiProtocol}://${apiUrl}/roomList`);
    const rooms = res.data;
    setRoomList(rooms);
  };

  useEffect(() => {
    fetchRoomList();
  }, []);

  return <div>
    <div>
      <Link to={`/room/${uuidv4()}`}>
        <Button>Create room</Button>
      </Link>
      <br />
      Room list:
      {roomList.map(room => {
        return <div className="roomIcon" key={room.id}>
          <p>{`Room ${room.name}`}</p>
          <p>{`Room id: ${room.id}`}</p>
          <p><Link to={`/room/${room.id}`}>connect</Link></p>
        </div>
      })}
    </div>
  </div>
}

export default Home;
