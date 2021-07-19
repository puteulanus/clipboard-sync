import './App.css';

import React from 'react';
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import Home from './Home';
import Room from './Room';

function App() {

  return (
    <div className="App">
      <Router>
        <Switch>
          <Route path="/room/:roomId" component={Room} />
          <Route path="/" component={Home} />
        </Switch>
      </Router>
      <a href="https://github.com/puteulanus/clipboard-sync">
        <img loading="lazy" width="149" height="149"
             src="https://github.blog/wp-content/uploads/2008/12/forkme_right_darkblue_121621.png?resize=149%2C149"
             className="fork-on-github" alt="Fork me on GitHub"
             data-recalc-dims="1" />
      </a>
    </div>
  );
}

export default App;
