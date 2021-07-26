if (process.env.NODE_ENV === "production") {
  module.exports = {
    apiUrl: 'cb2cb.herokuapp.com/api',
    apiProtocol: 's',
  }
} else {
  module.exports = {
    apiUrl: 'localhost:8080/api',
    apiProtocol: '',
  }
}
