package de.benwol.smarthome.ebus.model;

import com.fasterxml.jackson.core.util.ByteArrayBuilder;

public class EBusTelegramm implements EBusUsable {

    private EBusHeader eBusHeader;

    public EBusTelegramm() {

    }

    public byte[] byteArray() {
        ByteArrayBuilder builder = new ByteArrayBuilder();
        builder.write(eBusHeader.byteArray());
        // builder.write(TODO);
        return builder.toByteArray();
    }

}