package de.benwol.smarthome.ebus.model;

import com.fasterxml.jackson.core.util.ByteArrayBuilder;

public class EBusTelegramm {

    private EBusHeader eBusHeader;

    public EBusTelegramm() {
        eBusHeader = new EBusHeader();
    }

    public byte[] toByteArray() {
        ByteArrayBuilder builder = new ByteArrayBuilder();
        builder.write(eBusHeader.getHeaderByteArray());
        //builder.write(TODO);
        return builder.toByteArray();
    }

}