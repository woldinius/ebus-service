package de.benwol.smarthome.ebus.model;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.lessThanOrEqualTo;
import static org.junit.Assert.assertThat;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode
public class EBusTelegrammValue implements EBusUsable {

    public static EBusTelegrammValue of(int index, int length, byte... value) {
        return new EBusTelegrammValue(index, length, value);
    }

    private byte[] value;
    private int index;
    private int length;

    public EBusTelegrammValue(int index, int length, byte... value) {
        assertThat(value.length, lessThanOrEqualTo(length));
        assertThat(index, greaterThanOrEqualTo(0));
        setValue(value);
        setIndex(index);
        setLength(length);
    }

    @Override
    public byte[] byteArray() {
        byte[] byteArray = new byte[getLength()];
        byte[] presetValues = getValue();
        for (int i = presetValues.length; i < length; i++) {
            byteArray[i] = 0x00;
        }
        return byteArray;
    }
}