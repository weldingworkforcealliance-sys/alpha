export class Session{
  constructor(onState,onStatus){this.onState=onState;this.onStatus=onStatus;this.credentials=null;this.events=null;}
  async request(action,body){
    const response=await fetch(`/api/${action}`,{method:'POST',headers:{'Content-Type':'application/json',...(this.credentials?{Authorization:`Bearer ${this.credentials.token}`}:{})},body:JSON.stringify(body)});
    const data=await response.json();if(!response.ok)throw new Error(data.error);return data;
  }
  async create(){this.credentials=await this.request('create',{});this.connect();return this.credentials;}
  async join(id,invite){this.credentials=await this.request('join',{id,invite});this.connect();return this.credentials;}
  restore(){try{this.credentials=JSON.parse(sessionStorage.getItem('twinlane-v2'));}catch{}if(this.credentials)this.connect();return this.credentials;}
  connect(){
    this.events?.close();sessionStorage.setItem('twinlane-v2',JSON.stringify(this.credentials));
    const {id,token}=this.credentials;
    this.events=new EventSource(`/api/events?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`);
    this.events.onopen=()=>this.onStatus('Connected · shared world active');
    this.events.onmessage=e=>{try{this.onState(JSON.parse(e.data));}catch{this.onStatus('Invalid snapshot received');}};
    this.events.onerror=()=>this.onStatus('Disconnected · reconnecting. If the server restarted, leave and create a new session.');
  }
  send(command){return this.request('command',{id:this.credentials.id,command});}
  close(){this.events?.close();sessionStorage.removeItem('twinlane-v2');this.credentials=null;}
}
