package de.benwol.smarthome.ebus.model;

import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.MatcherAssert.assertThat;

import org.junit.Test;

public class EBusTelegrammValueTest {

    private final static byte[] TEST_VALUE = new byte[] { 0x01, 0x01 };

    @Test
    public void assertionTestEBusTelegrammValueIndex() {
        EBusTelegrammValue eBusTelegrammValue = new EBusTelegrammValue(0, TEST_VALUE.length, TEST_VALUE);
        assertThat("valid EBusTelegramm expected", eBusTelegrammValue, is(notNullValue()));

        try {
            new EBusTelegrammValue(-1, TEST_VALUE.length, TEST_VALUE);
        } catch (AssertionError assertionError) {
            assertThat("assertion error expected", assertionError, is(notNullValue()));
        }
    }

    @Test
    public void assertionTestEBusTelegrammValueValueAndLength() {
        EBusTelegrammValue eBusTelegrammValue = new EBusTelegrammValue(0, TEST_VALUE.length, TEST_VALUE);
        assertThat("valid EBusTelegramm expected", eBusTelegrammValue, is(notNullValue()));

        try {
            new EBusTelegrammValue(0, TEST_VALUE.length + 1, TEST_VALUE);
        } catch (AssertionError assertionError) {
            assertThat("assertion error expected", assertionError, is(notNullValue()));
        }
    }
}