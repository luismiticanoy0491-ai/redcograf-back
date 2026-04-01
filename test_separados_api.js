fetch("http://localhost:4000/separados").then(async res => ({status: res.status, body: await res.text()})).then(console.log).catch(console.error);
