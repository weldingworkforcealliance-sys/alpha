const API = 'https://qsmvgyyaemjmklceyikr.supabase.co/functions/v1/twinlane-v2-api';

export class Session {
  constructor(onState,onStatus){
    this.onState=onState;
    this.onStatus=onStatus;
    this.credentials=null;
    this.pollTimer=null;
    this.pollBusy=false;
  }

  async request(action,body={},method='POST'){
    const headers={'Content-Type':'application/json'};
    if(this.credentials?.token)headers.Authorization=`Bearer ${this.credentials.token}`;
    const response=await fetch(
      method==='GET'
        ? `${API}?api=state&id=${encodeURIComponent(body.id)}`
        : API,
      {
        method,
        headers,
        ...(method==='POST'?{body:JSON.stringify({action,...body})}:{})
      }
    );
    const data=await response.json().catch(()=>({error:'Invalid server response'}));
    if(!response.ok){
      const error=new Error(data.error||'Request failed');
      error.status=response.status;
      throw error;
    }
    return data;
  }

  async create(){
    const data=await this.request('create',{});
    this.credentials=data;
    sessionStorage.setItem('twinlane-v2',JSON.stringify(this.credentials));
    this.connect();
    return this.credentials;
  }

  async join(id,invite){
    const data=await this.request('join',{id,invite});
    this.credentials=data;
    sessionStorage.setItem('twinlane-v2',JSON.stringify(this.credentials));
    this.connect();
    return this.credentials;
  }

  async restore(invitationId=null){
    try{this.credentials=JSON.parse(sessionStorage.getItem('twinlane-v2'));}catch{}
    if(!this.credentials)return null;
    if(invitationId && (this.credentials.id!==invitationId || this.credentials.device!==2)){
      this.close();
      return null;
    }
    try{
      const snapshot=await this.request('state',{id:this.credentials.id},'GET');
      this.onState(snapshot.state);
    }catch(error){
      if(error.status===403||error.status===404){
        this.close();
        this.onStatus('Previous session ended. Start on Phone A or scan its newest invitation.');
        return null;
      }
      throw error;
    }
    this.connect();
    return this.credentials;
  }

  connect(){
    this.stopPolling();
    sessionStorage.setItem('twinlane-v2',JSON.stringify(this.credentials));
    this.onStatus('Connected · shared world active');
    const poll=async()=>{
      if(!this.credentials||this.pollBusy)return;
      this.pollBusy=true;
      try{
        const snapshot=await this.request('state',{id:this.credentials.id},'GET');
        this.onState(snapshot.state);
        if(this.credentials.device===1 && snapshot.screen2_joined){
          this.onStatus('Connected · Phone B joined · shared world active');
        }
      }catch(error){
        if(error.status===403||error.status===404){
          this.onStatus('Session ended. Leave this device and start a new session.');
          this.stopPolling();
        }else{
          this.onStatus('Connection interrupted · retrying');
        }
      }finally{
        this.pollBusy=false;
      }
    };
    void poll();
    this.pollTimer=setInterval(poll,80);
  }

  stopPolling(){
    if(this.pollTimer)clearInterval(this.pollTimer);
    this.pollTimer=null;
  }

  send(command){
    if(!this.credentials)throw new Error('No active session.');
    return this.request('command',{id:this.credentials.id,command});
  }

  close(){
    this.stopPolling();
    sessionStorage.removeItem('twinlane-v2');
    this.credentials=null;
  }
}
