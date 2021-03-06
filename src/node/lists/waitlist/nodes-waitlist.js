import NodeClient from 'node/sockets/node_clients/socket/node-client'
import NodesList from 'node/lists/nodes-list'
import NodesWaitlistObject from './nodes-waitlist-object';
import SocketAddress from 'common/sockets/socket-address'
import consts from 'consts/const_global'

class NodesWaitlist {

    /*
        waitlist = []     //Addresses where it should connect too
        events = []
        stated = false;
    */

    constructor(){
        console.log("NodeServiceClients constructor");

        this.waitlist = [];
        this.events = [];
        this.started = false;
    }


    async startConnecting(){

        if (this.started === false) {
            this.started = true;
            this._connectNewNodesWaitlist();
        }

    }

    addNewNodeToWaitlist(addresses, port){

        if ( (typeof addresses === "string" && addresses === '') || (typeof addresses === "object" && (addresses === null || addresses===[]))) return false;

        if (typeof addresses === "string" || !Array.isArray(addresses)) addresses = [addresses];

        //address = "127.0.0.1";

        let sckAddresses = [];
        for (let i=0; i<addresses.length; i++){

            let sckAddress = SocketAddress.createSocketAddress(addresses[i], port);

            if (this._searchNodesWaitlist(sckAddress) === null){
                sckAddresses.push(sckAddress);
            }

        }

        if (sckAddresses.length > 0){

            let waitlistObject = new NodesWaitlistObject(sckAddresses);
            this.waitlist.push(waitlistObject);

            this._callEvent("new-node-waitlist", null, waitlistObject);
            return waitlistObject;
        }
        
        return null;
    }

    _searchNodesWaitlist(address, port){

        let sckAddress = SocketAddress.createSocketAddress( address, port );

        for (let i=0; i<this.waitlist.length; i++)
            for (let j=0; j<this.waitlist[i].sckAddresses.length; j++)
                if (this.waitlist[i].sckAddresses[j].matchAddress(sckAddress) )
                    return this.waitlist[i];

        return null;
    }


    /*
        Connect to all nodes
    */
    _connectNewNodesWaitlist(){

        //console.log("Waitlist length", this.waitlist.length);
        //console.log(this.waitlist);

        for (let i=0; i < this.waitlist.length; i++){

            let nextNode = this.waitlist[i];



            if ( nextNode.checkLastTimeChecked(consts.NODES_WAITLIST_TRY_RECONNECT_AGAIN) && nextNode.blocked===false && nextNode.connecting===false && nextNode.checkIsConnected() === null ){

                nextNode.blocked = true;

                //console.log("connectNewNodesWaitlist ", nextNode.sckAddresses.toString() );

                this._connectNowToNewNode(nextNode).then( (connected)=>{
                    nextNode.checked = true;
                    nextNode.blocked = false;
                    nextNode.connected = connected;
                    nextNode.refreshLastTimeChecked();
                });

            }

        }


        setTimeout(()=>{return this._connectNewNodesWaitlist() }, consts.NODES_WAITLIST_INTERVAL);
    }

    async _connectNowToNewNode(nextNode){

        nextNode.connecting = true;

        //trying to connect to each sckAddresses
        for (let i=0; i<nextNode.sckAddresses.length; i++) {
            
            //search if the new protocol was already connected in the past
            let nodeClient = NodesList.searchNodeSocketByAddress(nextNode.sckAddresses[i], 'all', ["id","uuid"]);
            if (nodeClient !== null) return nodeClient;

            if (nextNode.socket !== null) nodeClient = nextNode.socket;
            else nodeClient = new NodeClient();

            try {
                let answer = await nodeClient.connectTo(nextNode.sckAddresses[i]);

                if (answer) nextNode.socketConnected(nodeClient);
                else nextNode.socketErrorConnected();

                nextNode.connecting = false;
                return answer;
            }
            catch (Exception) {
                console.log("Error connecting to new protocol waitlist", Exception.toString())
            }

        }
        nextNode.connecting = false;
        return false;
    }


    /*
        EVENTS - Callbacks
     */

    registerEvent(eventName, params, callback){

        this.events.push({
            name: eventName,
            params: params,
            callback: callback,
        })
    }

    _getEvents(eventName){

        let list = [];
        for (let i=0; i<this.events.length; i++)
            if (this.events[i].name === eventName)
                list.push(this.events[i]);

        return list;
    }

    _callEvent(eventName, err, param){
        let eventsList = this._getEvents(eventName);
        for (let j=0; j<eventsList.length; j++)
            eventsList[j].callback(err, param);
    }


}

export default new NodesWaitlist();