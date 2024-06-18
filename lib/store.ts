let listenerId: any;

export const setListenerId = (id: number): void => {
    listenerId = id;
    console.log("listenerId=======>>", listenerId);
};

export const getListenerId = () => {
    console.log("get Listter=======>>", listenerId);
    return listenerId
};