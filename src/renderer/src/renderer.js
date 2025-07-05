import Swal from 'sweetalert2';
var pcname;
var pcuser;
var iplocal;
if (window.electron) {
  window.electron.onIplocal((event, variableRecibida) => {
    document.getElementById('ip-local').innerText = variableRecibida;
    iplocal = variableRecibida;
  });
  window.electron.onNombrePC((event, variableRecibida) => {
    document.getElementById('pc-name').innerText = variableRecibida;
    pcname = variableRecibida;
  });
  window.electron.onUsername((event, variableRecibida) => {
    document.getElementById('pc-user').innerText = variableRecibida;
    pcuser = variableRecibida;
    getChequeos();
  });
} else {
  console.error('No se pudo acceder a window.electron');
}
function getChequeos() {
  const data = {
    pcname: pcname,
    pcuser: pcuser,
    iplocal: iplocal
  };
  window.electron.invoke('get-checador', data).then((response) => {
    if (response.error) {
      Swal.fire('Error', response.message, 'error');
    } else {
      if (response.length > 0) {
        const container = document.getElementById('chequeos');
        container.innerHTML = '';
        response.forEach((item, index) => {
          const newDiv = document.createElement('div');
          newDiv.classList.add('response-item');
          newDiv.innerHTML = item.mensaje;

          container.appendChild(newDiv);
        });
      }
    }
  });
}

document.querySelector('.boton-azul-animado').addEventListener('click', () => {
  Swal.fire({
    title: '¿Estás seguro?',
    text: '¿Deseas checar esta hora?',
    icon: 'question',
    confirmButtonText: 'Si, checar!',
    showCancelButton: true,
    cancelButtonColor: "#d33",
    cancelButtonText: "Cancelar...",
    background: '#1e3a8a',
    color: '#fff',
    confirmButtonColor: '#2563eb'
  }).then((result) => {
    if (result.isConfirmed) {
      const data = {
        pcname: pcname,
        pcuser: pcuser,
        iplocal: iplocal
      };
      window.electron.invoke('set-checador', data).then((response) => {
        if (response.error) {
          Swal.fire('Error', response.message, 'error');
        } else {
          if (response.status === 'success') {
            getChequeos();
            Swal.fire({
              background: '#1e3a8a',
              color: '#fff',
              confirmButtonColor: '#2563eb',
              title: 'Bien!',
              icon: 'success',
              confirmButtonText: 'Perfecto!',
              text: response.message
            });
          }
        }
      });
    }
  });
});

